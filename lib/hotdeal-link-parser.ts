import "server-only";

import type { HotDealMutationInput } from "./hot-deals";

const FETCH_TIMEOUT_MS = 10_000;

type ParsedHotDealInputResult =
  | {
      ok: true;
      input: HotDealMutationInput;
      usedFallback: boolean;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

type ProductMetadata = {
  title: string | null;
  imageUrl: string | null;
  priceText: string | null;
};

type JsonObject = Record<string, unknown>;

export async function createHotDealInputFromProductUrl(
  rawUrl: string,
): Promise<ParsedHotDealInputResult> {
  const targetUrl = normalizeProductUrl(rawUrl);

  if (!targetUrl) {
    return {
      ok: false,
      message: "http 또는 https 상품 주소를 입력해 주세요.",
    };
  }

  const fallbackInput = buildFallbackInput(targetUrl);

  try {
    const html = await fetchProductHtml(targetUrl);
    const metadata = extractProductMetadata(html, targetUrl);
    const title = metadata.title ?? fallbackInput.title;

    if (!title) {
      return {
        ok: false,
        message: "상품 제목을 찾지 못했습니다. 직접 입력으로 등록해 주세요.",
      };
    }

    return {
      ok: true,
      usedFallback: !metadata.title,
      message: metadata.title
        ? "상품 정보를 읽어 핫딜 입력값을 만들었습니다."
        : "상품 페이지에서 제목을 찾지 못해 URL 기준으로 입력값을 만들었습니다.",
      input: {
        ...fallbackInput,
        title,
        imageUrl: metadata.imageUrl,
        priceText: metadata.priceText,
      },
    };
  } catch {
    if (isCoupangUrl(targetUrl)) {
      return {
        ok: true,
        usedFallback: true,
        message: "쿠팡이 서버 접근을 막아 URL 기준으로 입력값을 만들었습니다.",
        input: fallbackInput,
      };
    }

    return {
      ok: false,
      message: "상품 페이지를 읽지 못했습니다. 직접 입력으로 등록해 주세요.",
    };
  }
}

function normalizeProductUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";

    if (isCoupangUrl(url)) {
      const itemId = url.searchParams.get("itemId");
      const vendorItemId = url.searchParams.get("vendorItemId");
      url.search = "";

      if (itemId) {
        url.searchParams.set("itemId", itemId);
      }

      if (vendorItemId) {
        url.searchParams.set("vendorItemId", vendorItemId);
      }
    }

    return url;
  } catch {
    return null;
  }
}

async function fetchProductHtml(url: URL) {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function extractProductMetadata(html: string, pageUrl: URL): ProductMetadata {
  const jsonLdProducts = extractJsonLdProducts(html);
  const jsonLdProduct = jsonLdProducts[0];
  const title =
    cleanTitle(readString(jsonLdProduct?.name)) ??
    cleanTitle(getMetaContent(html, ["og:title", "twitter:title"])) ??
    cleanTitle(getTitleTag(html));
  const imageUrl =
    normalizeOptionalUrl(readImageUrl(jsonLdProduct?.image), pageUrl) ??
    normalizeOptionalUrl(getMetaContent(html, ["og:image", "twitter:image"]), pageUrl);
  const priceText =
    formatPrice(readOfferPrice(jsonLdProduct)) ??
    formatPrice(getMetaContent(html, ["product:price:amount", "twitter:data1"]));

  return {
    title,
    imageUrl,
    priceText,
  };
}

function extractJsonLdProducts(html: string) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => parseJsonLd(match[1]))
    .filter((item) => getJsonLdType(item).includes("Product"));
}

function parseJsonLd(value: string): JsonObject[] {
  try {
    const parsed = JSON.parse(decodeHtmlEntities(value.trim())) as unknown;
    return flattenJsonLd(parsed);
  } catch {
    return [];
  }
}

function flattenJsonLd(value: unknown): JsonObject[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (!isJsonObject(value)) {
    return [];
  }

  const graph = Array.isArray(value["@graph"]) ? flattenJsonLd(value["@graph"]) : [];
  return [value, ...graph];
}

function getJsonLdType(value: JsonObject) {
  const type = value["@type"];
  return Array.isArray(type) ? type.map(String) : [String(type ?? "")];
}

function readOfferPrice(product: JsonObject | undefined) {
  const offers = product?.offers;
  const offer = Array.isArray(offers) ? offers.find(isJsonObject) : offers;
  if (!isJsonObject(offer)) {
    return null;
  }

  return readString(offer.price) ?? readString(offer.lowPrice);
}

function readImageUrl(value: unknown) {
  if (Array.isArray(value)) {
    return readString(value[0]);
  }

  if (isJsonObject(value)) {
    return readString(value.url);
  }

  return readString(value);
}

function getMetaContent(html: string, keys: string[]) {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = readHtmlAttributes(tag);
    const name = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();

    if (normalizedKeys.has(name) && attrs.content) {
      return decodeHtmlEntities(attrs.content).trim();
    }
  }

  return null;
}

function getTitleTag(html: string) {
  const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return matched ? stripTags(matched[1]) : null;
}

function readHtmlAttributes(tag: string) {
  const attrs: Record<string, string> = {};

  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[3]);
  }

  return attrs;
}

function buildFallbackInput(url: URL): HotDealMutationInput {
  return {
    title: buildFallbackTitle(url),
    dealUrl: url.toString(),
    imageUrl: null,
    priceText: null,
    category: isCoupangUrl(url) ? "쿠팡" : "쇼핑",
    status: "active",
    publishedAt: new Date().toISOString(),
    sourceName: "운영자 등록",
    sourceUrl: url.origin,
  };
}

function buildFallbackTitle(url: URL) {
  if (isCoupangUrl(url)) {
    const productId = url.pathname.match(/products\/(\d+)/)?.[1];
    return productId ? `쿠팡 상품 ${productId}` : "쿠팡 상품";
  }

  return `${url.hostname.replace(/^www\./, "")} 상품`;
}

function cleanTitle(value: string | null) {
  if (!value) {
    return null;
  }

  const title = stripTags(value)
    .replace(/\s*[-|:]\s*(쿠팡|Coupang|COUPANG)\s*$/i, "")
    .replace(/^쿠팡!\s*/, "")
    .trim();

  return title || null;
}

function stripTags(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOptionalUrl(value: string | null, baseUrl: URL) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatPrice(value: string | number | null) {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return `${value.toLocaleString("ko-KR")}원`;
  }

  const normalized = value.replace(/,/g, "").trim();
  const numeric = Number(normalized);

  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric.toLocaleString("ko-KR")}원`;
  }

  return value.trim() || null;
}

function isCoupangUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return hostname === "coupang.com" || hostname.endsWith(".coupang.com");
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();

    switch (normalized) {
      case "nbsp":
        return " ";
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        if (normalized.startsWith("#x")) {
          return decodeCodePoint(match, Number.parseInt(normalized.slice(2), 16));
        }

        if (normalized.startsWith("#")) {
          return decodeCodePoint(match, Number.parseInt(normalized.slice(1), 10));
        }

        return match;
    }
  });
}

function decodeCodePoint(fallback: string, codePoint: number) {
  return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}
