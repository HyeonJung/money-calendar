import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "./supabase-server";

export type HotDeal = {
  id: string;
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
};

export type HotDealStatus = "active" | "expired" | "hidden";

export type AdminHotDeal = HotDeal & {
  status: HotDealStatus;
  createdAt: string;
  updatedAt: string;
};

export type HotDealMutationInput = {
  title: string;
  dealUrl: string;
  imageUrl?: string | null;
  priceText?: string | null;
  category?: string | null;
  status: HotDealStatus;
  publishedAt?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type AdminHotDealListResult =
  | {
      ok: true;
      deals: AdminHotDeal[];
      message: string;
    }
  | {
      ok: false;
      deals: [];
      reason: "missing-env" | "schema-required" | "query-failed";
      message: string;
    };

type HotDealRow = {
  id: string;
  external_id: string;
  slug: string;
  title: string;
  source_name: string;
  source_url: string;
  deal_url: string;
  image_url: string | null;
  price_text: string | null;
  category: string | null;
  published_at: string | null;
  collected_at: string;
  like_count: number | string | null;
  comment_count: number | string | null;
  is_ad: boolean | null;
  status?: HotDealStatus | null;
  created_at?: string;
  updated_at?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const ALLOWED_SOURCE_NAMES = ["아카라이브", "어미새", "운영자 등록"];
const HOT_DEAL_STATUSES = new Set<HotDealStatus>(["active", "expired", "hidden"]);

export const sampleHotDeals: HotDeal[] = [
  {
    id: "sample-hotdeal-1",
    externalId: "sample-hotdeal-1",
    slug: "sample-hotdeal-1",
    title: "샘플 핫딜 데이터입니다. 수집 설정 후 실제 핫딜로 교체됩니다.",
    sourceName: "머니캘린더",
    sourceUrl: "/hotdeals",
    dealUrl: "/hotdeals",
    imageUrl: null,
    priceText: null,
    category: "안내",
    publishedAt: null,
    collectedAt: new Date().toISOString(),
    likeCount: null,
    commentCount: null,
    isAd: false,
  },
];

function hasSupabaseEnv() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function createSupabaseServerClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRowToHotDeal(row: HotDealRow): HotDeal {
  return {
    id: row.id,
    externalId: row.external_id,
    slug: row.slug,
    title: row.title,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    dealUrl: row.deal_url,
    imageUrl: row.image_url,
    priceText: row.price_text,
    category: row.category,
    publishedAt: row.published_at,
    collectedAt: row.collected_at,
    likeCount: toNumber(row.like_count),
    commentCount: toNumber(row.comment_count),
    isAd: Boolean(row.is_ad),
  };
}

function mapRowToAdminHotDeal(row: HotDealRow): AdminHotDeal {
  return {
    ...mapRowToHotDeal(row),
    status: row.status ?? "active",
    createdAt: row.created_at ?? row.collected_at,
    updatedAt: row.updated_at ?? row.collected_at,
  };
}

async function fetchHotDealsFromSupabase(limit: number) {
  const client = createSupabaseServerClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("hot_deals")
    .select("*")
    .eq("status", "active")
    .in("source_name", ALLOWED_SOURCE_NAMES)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[lib/hot-deals] Failed to fetch hot deals from Supabase:", error.message);
    return null;
  }

  return (data as HotDealRow[])
    .map(mapRowToHotDeal)
    .filter((deal) => !isCommunityPostUrl(deal.dealUrl, deal.sourceName));
}

export async function getHotDeals(limit = 40) {
  if (hasSupabaseEnv()) {
    const hotDeals = await fetchHotDealsFromSupabase(limit);
    if (hotDeals && hotDeals.length > 0) {
      return hotDeals;
    }
  }

  return sampleHotDeals;
}

export async function getAdminHotDeals(limit = 80): Promise<AdminHotDealListResult> {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      ok: false,
      deals: [],
      reason: "missing-env",
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜 목록을 조회할 수 없습니다.",
    };
  }

  const { data, error } = await client
    .from("hot_deals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const reason =
      error.message.includes("hot_deals") || error.message.includes("schema cache")
        ? "schema-required"
        : "query-failed";

    return {
      ok: false,
      deals: [],
      reason,
      message:
        reason === "schema-required"
          ? "hot_deals 테이블이 아직 DB에 적용되지 않았습니다."
          : `핫딜 목록을 조회하지 못했습니다: ${error.message}`,
    };
  }

  return {
    ok: true,
    deals: ((data ?? []) as HotDealRow[]).map(mapRowToAdminHotDeal),
    message: "핫딜 목록을 조회했습니다.",
  };
}

export async function createManualHotDeal(input: HotDealMutationInput, actorEmail: string) {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜을 저장할 수 없습니다." };
  }

  const normalized = normalizeHotDealInput(input);
  if (!normalized.ok) {
    return normalized;
  }

  const duplicate = await hasDuplicateDealUrl(normalized.value.dealUrl);
  if (duplicate) {
    return { ok: false, message: "이미 같은 상품 주소로 등록된 핫딜이 있습니다." };
  }

  const now = new Date().toISOString();
  const hash = createHash("sha1").update(normalized.value.dealUrl).digest("hex").slice(0, 16);
  const { error } = await client.from("hot_deals").insert({
    external_id: `manual-${hash}`,
    slug: `hotdeal-manual-${hash}`,
    title: normalized.value.title,
    source_name: normalized.value.sourceName,
    source_url: normalized.value.sourceUrl,
    deal_url: normalized.value.dealUrl,
    image_url: normalized.value.imageUrl,
    price_text: normalized.value.priceText,
    category: normalized.value.category,
    published_at: normalized.value.publishedAt ?? now,
    collected_at: now,
    like_count: null,
    comment_count: null,
    is_ad: false,
    status: normalized.value.status,
    raw_payload: {
      source: "manual",
      actorEmail,
    },
    updated_at: now,
  });

  if (error) {
    return { ok: false, message: `핫딜 등록에 실패했습니다: ${error.message}` };
  }

  return { ok: true, message: "핫딜을 등록했습니다." };
}

export async function updateManualHotDeal(
  id: string,
  input: HotDealMutationInput,
  actorEmail: string,
) {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜을 수정할 수 없습니다." };
  }

  const normalized = normalizeHotDealInput(input);
  if (!normalized.ok) {
    return normalized;
  }

  const duplicate = await hasDuplicateDealUrl(normalized.value.dealUrl, id);
  if (duplicate) {
    return { ok: false, message: "이미 같은 상품 주소로 등록된 다른 핫딜이 있습니다." };
  }

  const { error } = await client
    .from("hot_deals")
    .update({
      title: normalized.value.title,
      source_name: normalized.value.sourceName,
      source_url: normalized.value.sourceUrl,
      deal_url: normalized.value.dealUrl,
      image_url: normalized.value.imageUrl,
      price_text: normalized.value.priceText,
      category: normalized.value.category,
      published_at: normalized.value.publishedAt,
      status: normalized.value.status,
      raw_payload: {
        source: "manual",
        actorEmail,
        updatedByAdmin: true,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: `핫딜 수정에 실패했습니다: ${error.message}` };
  }

  return { ok: true, message: "핫딜을 수정했습니다." };
}

export async function deleteHotDeal(id: string) {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜을 삭제할 수 없습니다." };
  }

  const { error } = await client.from("hot_deals").delete().eq("id", id);

  if (error) {
    return { ok: false, message: `핫딜 삭제에 실패했습니다: ${error.message}` };
  }

  return { ok: true, message: "핫딜을 삭제했습니다." };
}

function isCommunityPostUrl(url: string, sourceName: string) {
  try {
    const hostname = new URL(url).hostname;
    const sourceHosts: Record<string, string[]> = {
      아카라이브: ["arca.live"],
      어미새: ["eomisae.co.kr", "www.eomisae.co.kr"],
    };

    return sourceHosts[sourceName]?.includes(hostname) ?? false;
  } catch {
    return false;
  }
}

function normalizeHotDealInput(input: HotDealMutationInput):
  | {
      ok: true;
      value: Required<Pick<HotDealMutationInput, "title" | "dealUrl" | "status">> &
        Omit<HotDealMutationInput, "title" | "dealUrl" | "status"> & {
          sourceName: string;
          sourceUrl: string;
          imageUrl: string | null;
          priceText: string | null;
          category: string | null;
          publishedAt: string | null;
        };
    }
  | {
      ok: false;
      message: string;
    } {
  const title = input.title.trim();
  const dealUrl = normalizeHttpUrl(input.dealUrl);
  const imageUrl = normalizeOptionalHttpUrl(input.imageUrl);
  const sourceUrl = normalizeOptionalHttpUrl(input.sourceUrl) ?? "/admin";
  const publishedAt = normalizeDateTime(input.publishedAt);

  if (!title) {
    return { ok: false, message: "핫딜 제목을 입력해 주세요." };
  }

  if (!dealUrl) {
    return { ok: false, message: "http 또는 https 상품 주소를 입력해 주세요." };
  }

  if (!HOT_DEAL_STATUSES.has(input.status)) {
    return { ok: false, message: "핫딜 상태가 올바르지 않습니다." };
  }

  if (input.imageUrl && !imageUrl) {
    return { ok: false, message: "이미지 주소는 http 또는 https URL이어야 합니다." };
  }

  return {
    ok: true,
    value: {
      title,
      dealUrl,
      imageUrl,
      priceText: emptyToNull(input.priceText),
      category: emptyToNull(input.category),
      status: input.status,
      publishedAt,
      sourceName: input.sourceName?.trim() || "운영자 등록",
      sourceUrl,
    },
  };
}

async function hasDuplicateDealUrl(dealUrl: string, excludeId?: string) {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return false;
  }

  let query = client.from("hot_deals").select("id").eq("deal_url", dealUrl).limit(1);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  return !error && Boolean(data?.length);
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
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

    return url.toString();
  } catch {
    return null;
  }
}

function isCoupangUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return hostname === "coupang.com" || hostname.endsWith(".coupang.com");
}

function normalizeOptionalHttpUrl(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalizeHttpUrl(normalized);
}

function normalizeDateTime(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
