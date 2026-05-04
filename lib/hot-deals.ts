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

export type AdminHotDealMetrics = {
  totalCount: number;
  activeCount: number;
  expiredCount: number;
  hiddenCount: number;
  expireCandidateCount: number;
  collectedTodayCount: number;
  collectedLast24HoursCount: number;
  manualCreatedTodayCount: number;
  activeWithoutImageCount: number;
  activeWithoutPriceCount: number;
  latestCollectedAt: string | null;
  sourceBreakdown: Array<{
    label: string;
    count: number;
  }>;
  categoryBreakdown: Array<{
    label: string;
    count: number;
  }>;
};

export type AdminHotDealMetricsResult =
  | {
      ok: true;
      metrics: AdminHotDealMetrics;
      message: string;
    }
  | {
      ok: false;
      metrics: null;
      reason: "missing-env" | "schema-required" | "query-failed";
      message: string;
    };

export type ExpireOldHotDealsResult =
  | {
      ok: true;
      expiredCount: number;
      cutoff: string;
      dryRun: boolean;
      message: string;
    }
  | {
      ok: false;
      expiredCount: 0;
      cutoff: string;
      dryRun: boolean;
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

type HotDealMetricRow = {
  source_name: string | null;
  category: string | null;
  collected_at: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const ALLOWED_SOURCE_NAMES = ["아카라이브", "어미새", "운영자 등록"];
const HOT_DEAL_STATUSES = new Set<HotDealStatus>(["active", "expired", "hidden"]);
export const HOT_DEAL_EXPIRATION_HOURS = 24;

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
    .gte("collected_at", getHotDealExpirationCutoffIso())
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

  return [];
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

export async function getAdminHotDealMetrics(): Promise<AdminHotDealMetricsResult> {
  const client = createSupabaseServiceRoleClient();

  if (!client) {
    return {
      ok: false,
      metrics: null,
      reason: "missing-env",
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜 운영 지표를 조회할 수 없습니다.",
    };
  }

  const serviceClient = client;
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getSeoulDayRange(now);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      totalCount,
      activeCount,
      expiredCount,
      hiddenCount,
      expireCandidateCount,
      collectedTodayCount,
      collectedLast24HoursCount,
      manualCreatedTodayCount,
      activeWithoutImageCount,
      activeWithoutPriceCount,
      latestCollectedAt,
      breakdownResult,
    ] = await Promise.all([
      countHotDeals(),
      countHotDeals({ status: "active" }),
      countHotDeals({ status: "expired" }),
      countHotDeals({ status: "hidden" }),
      countHotDeals({ status: "active", collectedTo: getHotDealExpirationCutoffIso(now) }),
      countHotDeals({ collectedFrom: todayStart, collectedTo: todayEnd }),
      countHotDeals({ collectedFrom: last24Hours }),
      countHotDeals({
        sourceName: "운영자 등록",
        createdFrom: todayStart,
        createdTo: todayEnd,
      }),
      countHotDeals({ status: "active", missingImage: true }),
      countHotDeals({ status: "active", missingPrice: true }),
      getLatestCollectedAt(),
      getBreakdownRows(),
    ]);

    if (!breakdownResult.ok) {
      return {
        ok: false,
        metrics: null,
        reason: breakdownResult.reason,
        message: breakdownResult.message,
      };
    }

    return {
      ok: true,
      message: "핫딜 운영 지표를 조회했습니다.",
      metrics: {
        totalCount,
        activeCount,
        expiredCount,
        hiddenCount,
        expireCandidateCount,
        collectedTodayCount,
        collectedLast24HoursCount,
        manualCreatedTodayCount,
        activeWithoutImageCount,
        activeWithoutPriceCount,
        latestCollectedAt,
        sourceBreakdown: buildBreakdown(
          breakdownResult.rows.map((row) => row.source_name ?? "미분류"),
        ),
        categoryBreakdown: buildBreakdown(
          breakdownResult.rows.map((row) => row.category ?? "미분류"),
        ),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown hot deal metrics error.";
    const reason =
      message.includes("hot_deals") || message.includes("schema cache")
        ? "schema-required"
        : "query-failed";

    return {
      ok: false,
      metrics: null,
      reason,
      message:
        reason === "schema-required"
          ? "hot_deals 테이블이 아직 DB에 적용되지 않았습니다."
          : `핫딜 운영 지표를 조회하지 못했습니다: ${message}`,
    };
  }

  async function countHotDeals(filters: {
    status?: HotDealStatus;
    sourceName?: string;
    collectedFrom?: string;
    collectedTo?: string;
    createdFrom?: string;
    createdTo?: string;
    missingImage?: boolean;
    missingPrice?: boolean;
  } = {}) {
    let query = serviceClient.from("hot_deals").select("id", { count: "exact", head: true });

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.sourceName) {
      query = query.eq("source_name", filters.sourceName);
    }

    if (filters.collectedFrom) {
      query = query.gte("collected_at", filters.collectedFrom);
    }

    if (filters.collectedTo) {
      query = query.lt("collected_at", filters.collectedTo);
    }

    if (filters.createdFrom) {
      query = query.gte("created_at", filters.createdFrom);
    }

    if (filters.createdTo) {
      query = query.lt("created_at", filters.createdTo);
    }

    if (filters.missingImage) {
      query = query.is("image_url", null);
    }

    if (filters.missingPrice) {
      query = query.is("price_text", null);
    }

    const { count, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return count ?? 0;
  }

  async function getLatestCollectedAt() {
    const { data, error } = await serviceClient
      .from("hot_deals")
      .select("collected_at")
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return typeof data?.collected_at === "string" ? data.collected_at : null;
  }

  async function getBreakdownRows(): Promise<
    | {
        ok: true;
        rows: HotDealMetricRow[];
      }
    | {
        ok: false;
        reason: "schema-required" | "query-failed";
        message: string;
      }
  > {
    const { data, error } = await serviceClient
      .from("hot_deals")
      .select("source_name, category, collected_at")
      .order("collected_at", { ascending: false })
      .limit(500);

    if (error) {
      const reason =
        error.message.includes("hot_deals") || error.message.includes("schema cache")
          ? "schema-required"
          : "query-failed";

      return {
        ok: false,
        reason,
        message:
          reason === "schema-required"
            ? "hot_deals 테이블이 아직 DB에 적용되지 않았습니다."
            : error.message,
      };
    }

    return {
      ok: true,
      rows: (data ?? []) as HotDealMetricRow[],
    };
  }
}

export async function expireOldHotDeals({
  dryRun = false,
  olderThanHours = HOT_DEAL_EXPIRATION_HOURS,
}: {
  dryRun?: boolean;
  olderThanHours?: number;
} = {}): Promise<ExpireOldHotDealsResult> {
  const client = createSupabaseServiceRoleClient();
  const cutoff = getHotDealExpirationCutoffIso(new Date(), olderThanHours);

  if (!client) {
    return {
      ok: false,
      expiredCount: 0,
      cutoff,
      dryRun,
      reason: "missing-env",
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 핫딜 자동 만료를 실행할 수 없습니다.",
    };
  }

  try {
    if (dryRun) {
      const { count, error } = await client
        .from("hot_deals")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lt("collected_at", cutoff);

      if (error) {
        return mapExpireError(error.message, cutoff, dryRun);
      }

      const expiredCount = count ?? 0;
      return {
        ok: true,
        expiredCount,
        cutoff,
        dryRun,
        message: `만료 대상 핫딜 ${expiredCount.toLocaleString("ko-KR")}건을 확인했습니다.`,
      };
    }

    const { data, error } = await client
      .from("hot_deals")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "active")
      .lt("collected_at", cutoff)
      .select("id");

    if (error) {
      return mapExpireError(error.message, cutoff, dryRun);
    }

    const expiredCount = data?.length ?? 0;
    return {
      ok: true,
      expiredCount,
      cutoff,
      dryRun,
      message: `24시간 지난 핫딜 ${expiredCount.toLocaleString("ko-KR")}건을 만료 처리했습니다.`,
    };
  } catch (error) {
    return mapExpireError(
      error instanceof Error ? error.message : "Unknown hot deal expiration error.",
      cutoff,
      dryRun,
    );
  }
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

function getSeoulDayRange(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(date).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function getHotDealExpirationCutoffIso(
  date = new Date(),
  olderThanHours = HOT_DEAL_EXPIRATION_HOURS,
) {
  return new Date(date.getTime() - olderThanHours * 60 * 60 * 1000).toISOString();
}

function mapExpireError(
  message: string,
  cutoff: string,
  dryRun: boolean,
): ExpireOldHotDealsResult {
  const reason =
    message.includes("hot_deals") || message.includes("schema cache")
      ? "schema-required"
      : "query-failed";

  return {
    ok: false,
    expiredCount: 0,
    cutoff,
    dryRun,
    reason,
    message:
      reason === "schema-required"
        ? "hot_deals 테이블이 아직 DB에 적용되지 않았습니다."
        : `핫딜 자동 만료에 실패했습니다: ${message}`,
  };
}

function buildBreakdown(labels: string[]) {
  const counts = new Map<string, number>();

  labels.forEach((label) => {
    const normalized = label.trim() || "미분류";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ko-KR"))
    .slice(0, 5);
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
