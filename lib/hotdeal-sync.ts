import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { expireOldHotDeals } from "./hot-deals";
import { createSupabaseServiceRoleClient } from "./supabase-server";

const FETCH_TIMEOUT_MS = 15_000;
const RECENT_HOT_DEAL_WINDOW_MS = 60 * 60 * 1000;
const SOURCE_LABEL = "핫딜 커뮤니티";

const HOT_DEAL_SOURCES = {
  arca: {
    id: "arca",
    name: "아카라이브",
    url: "https://arca.live/b/hotdeal",
    apiUrl: "https://arca.live/api/app/list/channel/hotdeal",
  },
  eomisae: {
    id: "eomisae",
    name: "어미새",
    url: "https://eomisae.co.kr/",
  },
} as const;

type JsonObject = Record<string, unknown>;

export type HotDealSourceItem = {
  externalId: string;
  slug: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  dealUrl: string;
  imageUrl: string | null;
  priceText: string | null;
  category: string | null;
  publishedAt: string | null;
  collectedAt: string;
  likeCount: number | null;
  commentCount: number | null;
  isAd: boolean;
  rawPayload: JsonObject;
};

export type HotDealSyncCounts = {
  sourcesFetched: number;
  itemsFetched: number;
  itemsNormalized: number;
  skipped: number;
  duplicateSkipped: number;
  expired: number;
  upserted: number;
};

export type HotDealSyncResult = {
  ok: boolean;
  dryRun: boolean;
  message: string;
  source: string;
  syncedAt: string;
  counts: HotDealSyncCounts;
  items: HotDealSourceItem[];
  warnings: string[];
  errors: string[];
};

type HotDealSyncOptions = {
  dryRun?: boolean;
  limit?: number;
};

type FetchSourceResult = {
  sourceName: string;
  items: HotDealSourceItem[];
  skipped: number;
  warning: string | null;
};

type ArcaArticle = {
  id?: number;
  title?: string;
  commentCount?: number | string;
  createdAt?: string;
  ratingUp?: number | string;
  thumbnailUrl?: string;
  categoryDisplayName?: string;
  deal?: {
    isClosed?: boolean;
    link?: string;
    store?: string;
    price?: {
      currency?: string;
      number?: number | string;
    };
    delivery?: {
      currency?: string;
      number?: number | string;
    };
  };
};

function createEmptyCounts(): HotDealSyncCounts {
  return {
    sourcesFetched: 0,
    itemsFetched: 0,
    itemsNormalized: 0,
    skipped: 0,
    duplicateSkipped: 0,
    expired: 0,
    upserted: 0,
  };
}

function createBaseResult(dryRun: boolean): HotDealSyncResult {
  return {
    ok: false,
    dryRun,
    message: "",
    source: SOURCE_LABEL,
    syncedAt: new Date().toISOString(),
    counts: createEmptyCounts(),
    items: [],
    warnings: [],
    errors: [],
  };
}

export async function fetchLatestHotDealsFromPublicSources(limit = 40) {
  const collected = await collectHotDealsFromSources(limit);
  return collected.items;
}

export async function syncHotDealsFromPublicSources({
  dryRun = false,
  limit = 40,
}: HotDealSyncOptions = {}): Promise<HotDealSyncResult> {
  const result = createBaseResult(dryRun);

  try {
    const collected = await collectHotDealsFromSources(limit);
    let items = collected.items;

    result.counts.sourcesFetched = collected.sourcesFetched;
    result.counts.itemsFetched = collected.itemsFetched;
    result.counts.skipped = collected.skipped;
    result.warnings = collected.warnings;

    const dedupedItems = dedupeItemsByDealUrl(items);
    result.counts.duplicateSkipped = items.length - dedupedItems.length;
    items = dedupedItems;

    const client = createSupabaseServiceRoleClient();
    const duplicateUrls = client ? await getExistingDealUrls(client, items) : new Set<string>();
    if (duplicateUrls.size > 0) {
      const beforeExistingDuplicateFilter = items.length;
      items = items.filter((item) => !duplicateUrls.has(item.dealUrl));
      result.counts.duplicateSkipped += beforeExistingDuplicateFilter - items.length;
    }

    const expirationResult = await expireOldHotDeals({ dryRun });
    if (expirationResult.ok) {
      result.counts.expired = expirationResult.expiredCount;
    } else if (expirationResult.reason !== "missing-env" || client) {
      result.warnings.push(expirationResult.message);
    }

    result.counts.itemsNormalized = items.length;
    result.items = items;

    if (items.length === 0) {
      result.ok = collected.sourcesFetched > 0 || result.counts.expired > 0;
      const baseMessage =
        collected.sourcesFetched > 0
          ? result.counts.duplicateSkipped > 0
            ? "최근 1시간 핫딜 중 새로 저장할 항목이 없습니다."
            : "수집된 핫딜이 없습니다."
          : "핫딜 소스에서 데이터를 가져오지 못했습니다.";
      const expirationMessage =
        result.counts.expired > 0
          ? dryRun
            ? ` 만료 대상 ${result.counts.expired.toLocaleString("ko-KR")}건을 확인했습니다.`
            : ` 만료 ${result.counts.expired.toLocaleString("ko-KR")}건을 처리했습니다.`
          : "";

      result.message = `${baseMessage}${expirationMessage}`;
      return result;
    }

    if (dryRun) {
      result.ok = true;
      result.message = `Dry run으로 핫딜 ${items.length}건과 만료 대상 ${result.counts.expired.toLocaleString("ko-KR")}건을 확인했습니다.`;
      return result;
    }

    if (!client) {
      result.ok = true;
      result.warnings.push(
        "SUPABASE_SERVICE_ROLE_KEY가 없어 DB 저장 없이 수집 결과만 반환했습니다.",
      );
      result.message = `핫딜 ${items.length}건을 수집했지만 DB에는 저장하지 않았습니다.`;
      return result;
    }

    const rows = items.map((item) => ({
      external_id: item.externalId,
      slug: item.slug,
      title: item.title,
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      deal_url: item.dealUrl,
      image_url: item.imageUrl,
      price_text: item.priceText,
      category: item.category,
      published_at: item.publishedAt,
      collected_at: item.collectedAt,
      like_count: item.likeCount,
      comment_count: item.commentCount,
      is_ad: item.isAd,
      status: "active",
      raw_payload: item.rawPayload,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client.from("hot_deals").insert(rows);

    if (error) {
      result.ok = false;
      result.errors.push(error.message);
      result.message =
        error.message.includes("hot_deals") || error.message.includes("schema cache")
          ? "hot_deals 테이블이 아직 DB에 적용되지 않았습니다."
          : `핫딜 저장에 실패했습니다: ${error.message}`;
      return result;
    }

    result.ok = true;
    result.counts.upserted = rows.length;
    result.message = `핫딜 ${rows.length}건을 동기화했고 만료 ${result.counts.expired.toLocaleString("ko-KR")}건을 처리했습니다.`;
    return result;
  } catch (error) {
    result.ok = false;
    result.errors.push(error instanceof Error ? error.message : "Unknown hot deal sync error.");
    result.message = "핫딜 수집 중 오류가 발생했습니다.";
    return result;
  }
}

async function collectHotDealsFromSources(limit: number) {
  const sourceResults = await Promise.all([
    fetchSourceSafely(parseArcaDeals),
    fetchSourceSafely(parseEomisaeDeals),
  ]);
  const deduped = new Map<string, HotDealSourceItem>();

  sourceResults.forEach((result) => {
    result.items.forEach((item) => {
      deduped.set(item.externalId, item);
    });
  });

  const collectedItems = [...deduped.values()].sort(compareHotDeals);
  const recentItems = collectedItems.filter(isRecentHotDeal);
  const items = recentItems.slice(0, Math.max(1, Math.min(Math.trunc(limit), 80)));

  return {
    sourcesFetched: sourceResults.filter((result) => result.warning === null).length,
    itemsFetched: sourceResults.reduce((total, result) => total + result.items.length, 0),
    skipped:
      sourceResults.reduce((total, result) => total + result.skipped, 0) +
      (collectedItems.length - recentItems.length),
    warnings: sourceResults
      .map((result) => result.warning)
      .filter((warning): warning is string => Boolean(warning)),
    items,
  };
}

function dedupeItemsByDealUrl(items: HotDealSourceItem[]) {
  const seen = new Set<string>();
  const deduped: HotDealSourceItem[] = [];

  items.forEach((item) => {
    if (seen.has(item.dealUrl)) {
      return;
    }

    seen.add(item.dealUrl);
    deduped.push(item);
  });

  return deduped;
}

async function getExistingDealUrls(
  client: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  items: HotDealSourceItem[],
) {
  const urls = [...new Set(items.map((item) => item.dealUrl))];
  if (urls.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await client
    .from("hot_deals")
    .select("deal_url")
    .in("deal_url", urls);

  if (error) {
    return new Set<string>();
  }

  return new Set((data ?? []).map((row) => String(row.deal_url)));
}

function isRecentHotDeal(item: HotDealSourceItem) {
  if (!item.publishedAt) {
    return false;
  }

  const publishedAt = new Date(item.publishedAt).getTime();
  if (!Number.isFinite(publishedAt)) {
    return false;
  }

  return Date.now() - publishedAt <= RECENT_HOT_DEAL_WINDOW_MS;
}

async function fetchSourceSafely(
  parser: () => Promise<FetchSourceResult>,
): Promise<FetchSourceResult> {
  try {
    return await parser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source fetch error.";
    return {
      sourceName: "unknown",
      items: [],
      skipped: 0,
      warning: message,
    };
  }
}

async function parseArcaDeals(): Promise<FetchSourceResult> {
  const source = HOT_DEAL_SOURCES.arca;
  const response = await fetch(source.apiUrl, {
    method: "GET",
    headers: {
      "user-agent": "net.umanle.arca.android.playstore/0.9.75",
      "x-device-token": randomBytes(32).toString("hex"),
      accept: "application/json",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${source.name} HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { articles?: ArcaArticle[] };
  const articles = Array.isArray(data.articles) ? data.articles : [];
  const collectedAt = new Date().toISOString();
  const items = (
    await mapLimit(articles, 6, (article) => normalizeArcaArticle(article, collectedAt))
  ).filter((item): item is HotDealSourceItem => item !== null);

  return {
    sourceName: source.name,
    items,
    skipped: Math.max(0, articles.length - items.length),
    warning: null,
  };
}

async function normalizeArcaArticle(
  article: ArcaArticle,
  collectedAt: string,
): Promise<HotDealSourceItem | null> {
  const source = HOT_DEAL_SOURCES.arca;
  const id = article.id;
  const title = normalizeText(article.title);

  if (!id || !title || article.deal?.isClosed) {
    return null;
  }

  const detail = await fetchArcaArticleDetail(id);
  const productUrl = normalizeUrl(detail?.deal?.link ?? article.deal?.link, source.url);
  if (!productUrl || !isExternalProductUrl(productUrl, source.url)) {
    return null;
  }

  const priceText = formatArcaPrice(article.deal);
  const category = normalizeText(article.categoryDisplayName) || inferCategory(title);

  return {
    externalId: `arca-${id}`,
    slug: `hotdeal-arca-${id}`,
    title,
    sourceName: source.name,
    sourceUrl: source.url,
    dealUrl: productUrl,
    imageUrl: normalizeUrl(article.thumbnailUrl, source.url),
    priceText,
    category,
    publishedAt: normalizeDate(article.createdAt),
    collectedAt,
    likeCount: toNumber(article.ratingUp),
    commentCount: toNumber(article.commentCount),
    isAd: false,
    rawPayload: {
      source: source.id,
      sourcePostUrl: `${source.url}/${id}`,
      article,
      detail: detail
        ? {
            deal: detail.deal,
            title: detail.title,
            updatedAt: detail.updatedAt,
          }
        : null,
    },
  };
}

async function fetchArcaArticleDetail(id: number) {
  const source = HOT_DEAL_SOURCES.arca;

  try {
    const response = await fetch(`${source.url}/${id}`.replace("/b/", "/api/app/view/article/"), {
      method: "GET",
      headers: {
        "user-agent": "net.umanle.arca.android.playstore/0.9.75",
        "x-device-token": randomBytes(32).toString("hex"),
        accept: "application/json",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ArcaArticle & {
      updatedAt?: string;
    };
  } catch {
    return null;
  }
}

async function parseEomisaeDeals(): Promise<FetchSourceResult> {
  const source = HOT_DEAL_SOURCES.eomisae;
  const html = await fetchText(source.url, source.url);
  const collectedAt = new Date().toISOString();
  const sectionStart = html.indexOf(">쇼핑정보<");
  const sectionHtml =
    sectionStart >= 0
      ? html.slice(sectionStart, html.indexOf("</dl>", sectionStart) + "</dl>".length)
      : html;
  const blocks = [...sectionHtml.matchAll(/<li(?:\s[^>]*)?>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/li>/gi)];
  const items = (
    await mapLimit(blocks, 4, async (match) => {
      try {
        return await normalizeEomisaeBlock(match[1], match[2], collectedAt);
      } catch {
        return null;
      }
    })
  ).filter((item): item is HotDealSourceItem => item !== null);

  return {
    sourceName: source.name,
    items,
    skipped: 0,
    warning: null,
  };
}

async function normalizeEomisaeBlock(
  href: string,
  block: string,
  collectedAt: string,
): Promise<HotDealSourceItem | null> {
  const source = HOT_DEAL_SOURCES.eomisae;
  const documentId = href.match(/\/(\d+)/)?.[1] ?? null;
  const title =
    stripTags(matchFirst(block, /<span[^>]*id="testfail"[^>]*>([\s\S]*?)<\/span>/i)) ||
    stripTags(block);

  if (!documentId || !title || href.includes("#")) {
    return null;
  }

  const sourcePostUrl = normalizeUrl(href, source.url);
  if (!sourcePostUrl) {
    return null;
  }

  const detail = await fetchEomisaeDetail(sourcePostUrl);
  if (!detail.productUrl) {
    return null;
  }

  return {
    externalId: `eomisae-${documentId}`,
    slug: `hotdeal-eomisae-${documentId}`,
    title,
    sourceName: source.name,
    sourceUrl: source.url,
    dealUrl: detail.productUrl,
    imageUrl: detail.imageUrl,
    priceText: extractPriceText(title),
    category: inferCategory(title) ?? "쇼핑정보",
    publishedAt: detail.publishedAt,
    collectedAt,
    likeCount: null,
    commentCount: null,
    isAd: false,
    rawPayload: {
      source: source.id,
      documentId,
      sourcePostUrl,
      blockHash: hashValue(block),
    },
  };
}

async function fetchEomisaeDetail(sourcePostUrl: string) {
  const html = await fetchText(sourcePostUrl, HOT_DEAL_SOURCES.eomisae.url);
  const extraUrlHtml = sliceBetween(html, '<td class="extra_url">', "</td>");
  const contentHtml =
    html.match(/<div class="document_[^"]*rhymix_content xe_content">([\s\S]*?)<\/div><!--AfterDocument/i)?.[1] ??
    "";
  const productUrl =
    extractFirstExternalUrl(extraUrlHtml ?? "", HOT_DEAL_SOURCES.eomisae.url) ??
    extractFirstExternalUrl(contentHtml, HOT_DEAL_SOURCES.eomisae.url);
  const imageUrl = normalizeUrl(
    matchFirst(contentHtml, /<img[^>]+src="([^"]+)"/i),
    HOT_DEAL_SOURCES.eomisae.url,
  );
  const publishedAt = normalizeDate(
    matchFirst(html, /<meta property="og:article:published_time" content="([^"]+)"/i),
  );

  return {
    productUrl,
    imageUrl,
    publishedAt,
  };
}

async function fetchText(url: string, referer: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; money-calendar/1.0)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      referer,
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${url} HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function compareHotDeals(left: HotDealSourceItem, right: HotDealSourceItem) {
  const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
  const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.title.localeCompare(right.title, "ko-KR");
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

function extractFirstExternalUrl(html: string, baseUrl: string) {
  const urls = [...html.matchAll(/<a[^>]+href="([^"]+)"/gi)]
    .map((match) => normalizeUrl(match[1], baseUrl))
    .filter((url): url is string => Boolean(url));

  return urls.find((url) => isExternalProductUrl(url, baseUrl)) ?? null;
}

function isExternalProductUrl(url: string, baseUrl: string) {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);

    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname !== base.hostname &&
      !parsed.hostname.endsWith(`.${base.hostname}`)
    );
  } catch {
    return false;
  }
}

function formatArcaPrice(deal: ArcaArticle["deal"]) {
  const price = toNumber(deal?.price?.number);
  const delivery = toNumber(deal?.delivery?.number);
  const priceText = formatMoney(price);

  if (!priceText) {
    return null;
  }

  if (delivery === null) {
    return priceText;
  }

  return `${priceText} / ${delivery === 0 ? "무료배송" : `배송 ${formatMoney(delivery)}`}`;
}

function formatMoney(value: number | null) {
  if (value === null) {
    return null;
  }

  if (value === 0) {
    return "무료";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function sliceBetween(value: string, startToken: string, endToken: string) {
  const start = value.indexOf(startToken);
  if (start < 0) {
    return null;
  }

  const end = value.indexOf(endToken, start + startToken.length);
  return end < 0 ? value.slice(start) : value.slice(start, end);
}

function matchFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? null;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function stripTags(value: string | null) {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: unknown, baseUrl: string) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = decodeHtmlEntities(value.trim());
  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractPriceText(title: string) {
  const matched = title.match(
    /(?:₩\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|만원|달러|USD|\$)/i,
  );

  return matched?.[0]?.replace(/\s+/g, "") ?? null;
}

function inferCategory(title: string) {
  const normalized = title.toLowerCase();
  const categoryRules: Array<[string, string[]]> = [
    ["디지털", ["노트북", "모니터", "ssd", "메모리", "키보드", "마우스", "갤럭시", "아이폰", "아이패드"]],
    ["가전", ["청소기", "냉장고", "세탁기", "에어컨", "공기청정기", "전자레인지"]],
    ["식품", ["치킨", "라면", "커피", "쌀", "고기", "과자", "음료", "우유", "만두", "김치"]],
    ["생활", ["샴푸", "세제", "화장지", "물티슈", "마스크", "수건", "칫솔", "치약"]],
    ["패션", ["신발", "자켓", "티셔츠", "바지", "가방", "운동화", "양말", "자라"]],
    ["육아", ["기저귀", "분유", "유아", "아기", "장난감"]],
  ];

  return (
    categoryRules.find(([, keywords]) =>
      keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
    )?.[0] ?? null
  );
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function hashValue(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
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
      case "#39":
        return "'";
      default:
        break;
    }

    if (normalized.startsWith("#x")) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    if (normalized.startsWith("#")) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return match;
  });
}
