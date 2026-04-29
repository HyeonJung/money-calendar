import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Ipo, IpoStatus } from "./ipos";

const PUBLIC_SOURCE_NAME = "38커뮤니케이션";
const PUBLIC_SOURCE_BASE_URL = "https://www.38.co.kr";
const PUBLIC_LIST_PATH = "/html/fund/index.htm?o=k";
const DEFAULT_ENCODING = "euc-kr";
const FETCH_TIMEOUT_MS = 15_000;
const LOOKBACK_DAYS = 120;
const MAX_PAGE_LIMIT = 25;
const DETAIL_CONCURRENCY = 4;
const DEFAULT_DESCRIPTION =
  "공개 공모주 일정 데이터를 기준으로 정규화한 항목입니다. 실제 일정과 공모 조건은 증권신고서 정정에 따라 변경될 수 있습니다.";
const DEFAULT_RISKS = [
  "증권신고서 정정이나 주관사 공지에 따라 일정이 변경될 수 있습니다.",
  "확정 공모가, 경쟁률, 상장일은 공개 시점에 따라 일부 비어 있을 수 있습니다.",
  "상장 직후에는 유통 물량과 수급에 따라 변동성이 확대될 수 있습니다.",
];

type SourceListEntry = {
  companyName: string;
  detailPath: string;
  detailId: string | null;
  subscriptionStart: string;
  subscriptionEnd: string;
  confirmedOfferPrice: number | null;
  offerPriceRangeLow: number | null;
  offerPriceRangeHigh: number | null;
  competitionRate: number | null;
  underwriters: string[];
  marketHint: string | null;
};

type SyncOptions = {
  dryRun?: boolean;
};

type SourceDetail = {
  companyCode: string | null;
  market: string | null;
  sector: string | null;
  totalShares: number | null;
  publicOfferingShares: number | null;
  refundDate: string | null;
  listingDate: string | null;
  leadManager: string | null;
  competitionRate: number | null;
  lockupRate: number | null;
};

type IpoUpsertRow = {
  slug: string;
  company_name: string;
  market: string;
  sector: string;
  offering_type: string;
  status: IpoStatus;
  subscription_start: string;
  subscription_end: string;
  refund_date: string;
  listing_date: string;
  confirmed_offer_price: number | null;
  offer_price_range_low: number | null;
  offer_price_range_high: number | null;
  total_shares: number | null;
  public_offering_shares: number | null;
  underwriters: string[];
  lead_manager: string;
  competition_rate: number | null;
  lockup_rate: number | null;
  institutional_commitment_rate: number | null;
  expected_market_cap: number | null;
  description: string;
  highlights: string[];
  risks: string[];
  updated_at: string;
};

export type SyncCounts = {
  pagesFetched: number;
  rowsFetched: number;
  detailsFetched: number;
  detailFailures: number;
  itemsNormalized: number;
  skipped: number;
  upserted: number;
};

export type SyncResult = {
  ok: boolean;
  dryRun: boolean;
  message: string;
  source: string;
  syncedAt: string;
  counts: SyncCounts;
  items: Ipo[];
  warnings: string[];
  errors: string[];
};

export type IpoSyncResult = SyncResult;

function createEmptyCounts(): SyncCounts {
  return {
    pagesFetched: 0,
    rowsFetched: 0,
    detailsFetched: 0,
    detailFailures: 0,
    itemsNormalized: 0,
    skipped: 0,
    upserted: 0,
  };
}

function createBaseResult(): SyncResult {
  return {
    ok: false,
    dryRun: true,
    message: "",
    source: PUBLIC_SOURCE_NAME,
    syncedAt: new Date().toISOString(),
    counts: createEmptyCounts(),
    items: [],
    warnings: [],
    errors: [],
  };
}

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    ""
  );
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

async function fetchPublicHtml(pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${PUBLIC_SOURCE_BASE_URL}${pathOrUrl}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; korea-ipo-calendar/1.0; +https://www.38.co.kr/)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      pragma: "no-cache",
      "cache-control": "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const charset = normalizeEncoding(
    charsetMatch?.[1]?.trim().toLowerCase() || DEFAULT_ENCODING,
  );
  const buffer = await response.arrayBuffer();

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function normalizeEncoding(value: string) {
  if (value === "euc_kr" || value === "euckr") {
    return "euc-kr";
  }

  return value;
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
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
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }

    if (normalized.startsWith("#")) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }

    return _;
  });
}

function stripTags(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompanyName(value: string) {
  return value.replace(/\(유가\)\s*$/u, "").trim();
}

function parseNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const matched = value
    .replace(/[,\s]/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  if (!matched) {
    return null;
  }

  const parsed = Number.parseFloat(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null | undefined) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function splitByComma(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatKstDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addBusinessDaysToIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  let remaining = days;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }

  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function parseShortRange(value: string) {
  const compact = value.replace(/\s+/g, "");
  const matched = compact.match(
    /(\d{4})\.(\d{2})\.(\d{2})~(?:(\d{4})\.)?(\d{2})\.(\d{2})/,
  );

  if (!matched) {
    return null;
  }

  const startYear = Number.parseInt(matched[1], 10);
  const startMonth = Number.parseInt(matched[2], 10);
  const startDay = Number.parseInt(matched[3], 10);
  let endYear = matched[4] ? Number.parseInt(matched[4], 10) : startYear;
  const endMonth = Number.parseInt(matched[5], 10);
  const endDay = Number.parseInt(matched[6], 10);

  if (!matched[4] && endMonth < startMonth) {
    endYear += 1;
  }

  return {
    start: toIsoDate(startYear, startMonth, startDay),
    end: toIsoDate(endYear, endMonth, endDay),
  };
}

function parseFullDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const matched = value.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!matched) {
    return null;
  }

  return toIsoDate(
    Number.parseInt(matched[1], 10),
    Number.parseInt(matched[2], 10),
    Number.parseInt(matched[3], 10),
  );
}

function formatPriceRange(low: number | null, high: number | null) {
  if (low === null && high === null) {
    return null;
  }

  if (low !== null && high !== null) {
    return `${low.toLocaleString("ko-KR")}원~${high.toLocaleString("ko-KR")}원`;
  }

  const value = low ?? high;
  return value === null ? null : `${value.toLocaleString("ko-KR")}원`;
}

function normalizeMarket(value: string | null | undefined, fallback?: string | null) {
  const source = `${value ?? ""} ${fallback ?? ""}`;

  if (/코스닥/i.test(source)) {
    return "KOSDAQ";
  }

  if (/코스피|유가/i.test(source)) {
    return "KOSPI";
  }

  if (/코넥스/i.test(source)) {
    return "KONEX";
  }

  return "KOSDAQ";
}

function normalizeStatus(
  todayIso: string,
  subscriptionStart: string,
  subscriptionEnd: string,
  listingDate: string,
): IpoStatus {
  if (listingDate <= todayIso) {
    return "listed";
  }

  if (subscriptionStart <= todayIso && todayIso <= subscriptionEnd) {
    return "active";
  }

  return "upcoming";
}

function buildSlug(companyCode: string | null, detailId: string | null, seed: string) {
  if (companyCode) {
    return `ipo-${companyCode.toLowerCase()}`;
  }

  if (detailId) {
    return `ipo-38-${detailId}`;
  }

  return `ipo-${createHash("sha1").update(seed).digest("hex").slice(0, 12)}`;
}

function buildDescription(
  companyName: string,
  market: string,
  leadManager: string,
  subscriptionStart: string,
  subscriptionEnd: string,
  status: IpoStatus,
) {
  if (!leadManager) {
    return `${companyName} ${market} 공모주 일정 데이터입니다. 청약 기간은 ${subscriptionStart}부터 ${subscriptionEnd}까지이며, 공개 소스 기준으로 정규화했습니다.`;
  }

  if (status === "listed") {
    return `${companyName} ${market} 공모주 데이터입니다. ${leadManager} 주관 건으로 수집되었으며, 공개 일정 기준 상장 완료 상태로 정규화했습니다.`;
  }

  return `${companyName} ${market} 공모주 일정 데이터입니다. ${leadManager} 주관으로 ${subscriptionStart}부터 ${subscriptionEnd}까지 청약 일정이 공개되어 있습니다.`;
}

function buildHighlights(ipo: Ipo) {
  const highlights = [
    `${ipo.market} 시장 공모주`,
    ipo.leadManager ? `대표 주관사 ${ipo.leadManager}` : null,
    formatPriceRange(ipo.offerPriceRangeLow, ipo.offerPriceRangeHigh)
      ? `희망 공모가 ${formatPriceRange(ipo.offerPriceRangeLow, ipo.offerPriceRangeHigh)}`
      : null,
    ipo.confirmedOfferPrice !== null
      ? `확정 공모가 ${ipo.confirmedOfferPrice.toLocaleString("ko-KR")}원`
      : null,
    ipo.listingDate ? `상장일 ${ipo.listingDate}` : null,
  ];

  return highlights.filter(Boolean).slice(0, 3) as string[];
}

function buildRisks(ipo: Ipo) {
  const risks = [...DEFAULT_RISKS];

  if (ipo.confirmedOfferPrice === null) {
    risks[1] = "확정 공모가와 최종 경쟁률은 청약 종료 전후에 추가 공개될 수 있습니다.";
  }

  return risks.slice(0, 3);
}

function extractFirstMatch(html: string, pattern: RegExp) {
  const matched = html.match(pattern);
  return matched?.[1] ? stripTags(matched[1]) : null;
}

function extractScheduleTable(html: string) {
  const matched = html.match(
    /<table[^>]*summary=["']공모주 청약일정["'][^>]*>([\s\S]*?)<\/table>/i,
  );

  return matched?.[1] ?? null;
}

function parseListRows(html: string) {
  const tableHtml = extractScheduleTable(html);
  if (!tableHtml) {
    throw new Error("공모주 청약일정 테이블을 찾지 못했습니다.");
  }

  const rows = [...tableHtml.matchAll(/<tr[^>]*bgcolor=['"][^'"]+['"][^>]*>([\s\S]*?)<\/tr>/gi)];

  return rows
    .map((matched) => {
      const cells = [...matched[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (cell) => cell[1],
      );

      if (cells.length < 6) {
        return null;
      }

      const companyCell = cells[0];
      const schedule = parseShortRange(stripTags(cells[1]));
      if (!schedule) {
        return null;
      }

      const hrefMatch = companyCell.match(/href=['"]([^'"]+)['"]/i);
      const detailPath = decodeHtmlEntities(hrefMatch?.[1] ?? "").trim();
      if (!detailPath) {
        return null;
      }

      const detailIdMatch = detailPath.match(/[?&]no=(\d+)/i);
      const companyName = cleanCompanyName(stripTags(companyCell));
      const marketHint = /\(유가\)|유가증권시장/i.test(companyCell) ? "KOSPI" : null;

      return {
        companyName,
        detailPath,
        detailId: detailIdMatch?.[1] ?? null,
        subscriptionStart: schedule.start,
        subscriptionEnd: schedule.end,
        confirmedOfferPrice: parseInteger(stripTags(cells[2])),
        offerPriceRangeLow: parseInteger(stripTags(cells[3]).split("~")[0] ?? ""),
        offerPriceRangeHigh: parseInteger(stripTags(cells[3]).split("~")[1] ?? ""),
        competitionRate: parseNumber(stripTags(cells[4])),
        underwriters: splitByComma(stripTags(cells[5])),
        marketHint,
      } satisfies SourceListEntry;
    })
    .filter((entry): entry is SourceListEntry => Boolean(entry));
}

function extractMaxPage(html: string) {
  const lastPageMatch = html.match(/page=(\d+)'?>\[마지막\]/i);
  if (lastPageMatch) {
    return Number.parseInt(lastPageMatch[1], 10);
  }

  const pages = [...html.matchAll(/page=(\d+)/gi)]
    .map((matched) => Number.parseInt(matched[1], 10))
    .filter(Number.isFinite);

  return pages.length > 0 ? Math.max(...pages) : 1;
}

function parseLeadManagerTable(html: string, fallbackUnderwriters: string[]) {
  const managerRows = [
    ...html.matchAll(
      /<td bgcolor='#FFFFFF' align=center height=22>([^<]+)<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td bgcolor='#FFFFFF' align=center>([^<]+)<\/td>/gi,
    ),
  ];

  for (const matched of managerRows) {
    const underwriter = stripTags(matched[1]);
    const role = stripTags(matched[2]);

    if (underwriter && /대표/.test(role)) {
      return underwriter;
    }
  }

  return fallbackUnderwriters[0] ?? null;
}

function parseDetailPage(html: string, fallbackUnderwriters: string[]): SourceDetail {
  const market = extractFirstMatch(
    html,
    /시장구분<\/td>\s*<td[^>]*>\s*&nbsp;\s*([^<]+)/i,
  );
  const sector = extractFirstMatch(
    html,
    /업종\s*<\/td>\s*<td[^>]*>\s*&nbsp;\s*([^<]+)/i,
  );
  const companyCode = extractFirstMatch(
    html,
    /종목코드<\/td>\s*<td[^>]*>\s*&nbsp;\s*([^<]+)/i,
  );
  const totalShares = parseInteger(
    extractFirstMatch(
      html,
      /총공모주식수\s*<\/td>\s*<td[^>]*>\s*&nbsp;\s*([^<]+)/i,
    ),
  );
  const publicOfferingShares = parseInteger(
    extractFirstMatch(html, /주식수:\s*([\d,]+)\s*주/i),
  );
  const refundDate = parseFullDate(
    extractFirstMatch(html, /환불일<\/td>\s*<td[^>]*>\s*&nbsp;\s*([0-9.]+)/i),
  );
  const listingDate =
    parseFullDate(
      extractFirstMatch(html, /상장일<\/td>\s*<td[^>]*>\s*&nbsp;\s*([0-9.]+)/i),
    ) ??
    parseFullDate(
      extractFirstMatch(html, /신규상장일<\/font>&nbsp;\s*<\/td>\s*<td[^>]*>\s*([0-9.]+)/i),
    );
  const competitionRate = parseNumber(
    extractFirstMatch(
      html,
      /기관경쟁률<\/font>&nbsp;\s*<\/td>\s*<td[^>]*>\s*([0-9.:]+)/i,
    ),
  );
  const lockupRate = parseNumber(
    extractFirstMatch(
      html,
      /의무보유확약<\/font>&nbsp;\s*<\/td>\s*<td[^>]*>\s*([0-9.]+%?)/i,
    ),
  );

  return {
    companyCode,
    market,
    sector,
    totalShares,
    publicOfferingShares,
    refundDate,
    listingDate,
    leadManager: parseLeadManagerTable(html, fallbackUnderwriters),
    competitionRate,
    lockupRate,
  };
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  limit: number,
  mapper: (item: Input, index: number) => Promise<Output>,
) {
  const results = new Array<Output>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function toUpsertRow(ipo: Ipo): IpoUpsertRow {
  return {
    slug: ipo.slug,
    company_name: ipo.companyName,
    market: ipo.market,
    sector: ipo.sector,
    offering_type: ipo.offeringType,
    status: ipo.status,
    subscription_start: ipo.subscriptionStart,
    subscription_end: ipo.subscriptionEnd,
    refund_date: ipo.refundDate,
    listing_date: ipo.listingDate,
    confirmed_offer_price: ipo.confirmedOfferPrice,
    offer_price_range_low: ipo.offerPriceRangeLow,
    offer_price_range_high: ipo.offerPriceRangeHigh,
    total_shares: ipo.totalShares,
    public_offering_shares: ipo.publicOfferingShares,
    underwriters: ipo.underwriters,
    lead_manager: ipo.leadManager,
    competition_rate: ipo.competitionRate,
    lockup_rate: ipo.lockupRate,
    institutional_commitment_rate: ipo.institutionalCommitmentRate,
    expected_market_cap: ipo.expectedMarketCap,
    description: ipo.description,
    highlights: ipo.highlights,
    risks: ipo.risks,
    updated_at: new Date().toISOString(),
  };
}

async function upsertIpos(rows: IpoUpsertRow[]) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return 0;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client
    .from("ipos")
    .upsert(rows, { onConflict: "slug" })
    .select("slug");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? rows.length;
}

async function collectListEntries(result: SyncResult) {
  const entries: SourceListEntry[] = [];
  const todayIso = formatKstDate(new Date());
  const cutoffIso = addDaysToIsoDate(todayIso, -LOOKBACK_DAYS);

  let maxPage = 1;
  for (let page = 1; page <= maxPage && page <= MAX_PAGE_LIMIT; page += 1) {
    let html: string;

    try {
      const path = page === 1 ? PUBLIC_LIST_PATH : `${PUBLIC_LIST_PATH}&page=${page}`;
      html = await fetchPublicHtml(path);
    } catch (error) {
      result.warnings.push(
        `목록 페이지 ${page} 수집에 실패했습니다: ${toErrorMessage(error)}`,
      );
      break;
    }

    if (page === 1) {
      maxPage = Math.min(extractMaxPage(html), MAX_PAGE_LIMIT);
    }

    const rows = parseListRows(html);
    result.counts.pagesFetched += 1;
    result.counts.rowsFetched += rows.length;

    if (rows.length === 0) {
      break;
    }

    const relevantRows = rows.filter((row) => row.subscriptionEnd >= cutoffIso);
    result.counts.skipped += rows.length - relevantRows.length;
    entries.push(...relevantRows);

    const oldestRow = rows[rows.length - 1];
    if (oldestRow.subscriptionEnd < cutoffIso) {
      break;
    }
  }

  const deduped = new Map<string, SourceListEntry>();
  for (const entry of entries) {
    const key = `${entry.detailId ?? entry.companyName}-${entry.subscriptionStart}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return [...deduped.values()];
}

function normalizeIpo(
  listEntry: SourceListEntry,
  detail: SourceDetail | null,
  todayIso: string,
) {
  const companyCode = detail?.companyCode ?? null;
  const market = normalizeMarket(detail?.market, listEntry.marketHint);
  const refundDate =
    detail?.refundDate ?? addBusinessDaysToIsoDate(listEntry.subscriptionEnd, 2);
  const listingDate =
    detail?.listingDate ?? addBusinessDaysToIsoDate(listEntry.subscriptionEnd, 8);
  const leadManager = detail?.leadManager ?? listEntry.underwriters[0] ?? "";
  const status = normalizeStatus(
    todayIso,
    listEntry.subscriptionStart,
    listEntry.subscriptionEnd,
    listingDate,
  );

  const ipo: Ipo = {
    id: buildSlug(
      companyCode,
      listEntry.detailId,
      `${listEntry.companyName}-${listEntry.subscriptionStart}`,
    ),
    slug: buildSlug(
      companyCode,
      listEntry.detailId,
      `${listEntry.companyName}-${listEntry.subscriptionStart}`,
    ),
    companyName: listEntry.companyName,
    market,
    sector: detail?.sector ?? "",
    offeringType: "신규상장",
    status,
    subscriptionStart: listEntry.subscriptionStart,
    subscriptionEnd: listEntry.subscriptionEnd,
    refundDate,
    listingDate,
    confirmedOfferPrice: listEntry.confirmedOfferPrice,
    offerPriceRangeLow: listEntry.offerPriceRangeLow,
    offerPriceRangeHigh: listEntry.offerPriceRangeHigh,
    totalShares: detail?.totalShares ?? null,
    publicOfferingShares: detail?.publicOfferingShares ?? null,
    underwriters: listEntry.underwriters,
    leadManager,
    competitionRate: listEntry.competitionRate ?? detail?.competitionRate ?? null,
    lockupRate: detail?.lockupRate ?? null,
    institutionalCommitmentRate: null,
    expectedMarketCap: null,
    description: buildDescription(
      listEntry.companyName,
      market,
      leadManager,
      listEntry.subscriptionStart,
      listEntry.subscriptionEnd,
      status,
    ),
    highlights: [],
    risks: [],
  };

  ipo.highlights = buildHighlights(ipo);
  ipo.risks = buildRisks(ipo);

  if (!ipo.description) {
    ipo.description = DEFAULT_DESCRIPTION;
  }

  if (ipo.highlights.length === 0) {
    ipo.highlights = [`청약일정 ${ipo.subscriptionStart}~${ipo.subscriptionEnd}`];
  }

  if (ipo.risks.length === 0) {
    ipo.risks = [...DEFAULT_RISKS];
  }

  return ipo;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function syncIposFromPublicSources(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const result = createBaseResult();
  const todayIso = formatKstDate(new Date());

  try {
    const listEntries = await collectListEntries(result);

    if (listEntries.length === 0) {
      result.message = `${PUBLIC_SOURCE_NAME}에서 정규화할 공모주 일정 데이터를 찾지 못했습니다.`;
      result.errors.push(result.message);
      return result;
    }

    const normalizedItems = await mapWithConcurrency(
      listEntries,
      DETAIL_CONCURRENCY,
      async (entry) => {
        let detail: SourceDetail | null = null;

        try {
          const detailHtml = await fetchPublicHtml(entry.detailPath);
          detail = parseDetailPage(detailHtml, entry.underwriters);
          result.counts.detailsFetched += 1;
        } catch (error) {
          result.counts.detailFailures += 1;
          result.warnings.push(
            `${entry.companyName} 상세 정보 수집에 실패해 목록 데이터만 사용합니다: ${toErrorMessage(
              error,
            )}`,
          );
        }

        return normalizeIpo(entry, detail, todayIso);
      },
    );

    result.items = normalizedItems;
    result.counts.itemsNormalized = normalizedItems.length;

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const canWrite = !options.dryRun && Boolean(supabaseUrl && serviceRoleKey);

    if (!canWrite) {
      result.ok = true;
      result.dryRun = true;
      result.message = options.dryRun
        ? `${PUBLIC_SOURCE_NAME} 공모주 ${normalizedItems.length}건을 수집했고, 요청에 따라 dry run으로 종료했습니다.`
        : serviceRoleKey
        ? `${PUBLIC_SOURCE_NAME} 공모주 ${normalizedItems.length}건을 수집했지만 Supabase URL이 없어 dry run으로 종료했습니다.`
        : `${PUBLIC_SOURCE_NAME} 공모주 ${normalizedItems.length}건을 수집했고, SUPABASE_SERVICE_ROLE_KEY가 없어 dry run으로 종료했습니다.`;
      return result;
    }

    try {
      result.counts.upserted = await upsertIpos(normalizedItems.map(toUpsertRow));
    } catch (error) {
      const message = `Supabase ipos upsert에 실패했습니다: ${toErrorMessage(error)}`;
      console.error("[lib/ipo-sync]", message);
      result.errors.push(message);
      result.message = `${PUBLIC_SOURCE_NAME} 데이터 ${normalizedItems.length}건을 정규화했지만 저장에는 실패했습니다.`;
      result.dryRun = false;
      return result;
    }

    result.ok = true;
    result.dryRun = false;
    result.message = `${PUBLIC_SOURCE_NAME} 공모주 ${normalizedItems.length}건을 수집했고 ${result.counts.upserted}건을 Supabase ipos 테이블에 upsert했습니다.`;
    return result;
  } catch (error) {
    const message = `공개 공모주 일정 수집에 실패했습니다: ${toErrorMessage(error)}`;
    console.error("[lib/ipo-sync]", message);
    result.errors.push(message);
    result.message = message;
    return result;
  }
}
