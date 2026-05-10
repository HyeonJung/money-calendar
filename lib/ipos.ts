import "server-only";

import { createClient } from "@supabase/supabase-js";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type IpoStatus = "active" | "upcoming" | "listed";

export type Ipo = {
  id: string;
  slug: string;
  companyName: string;
  market: string;
  sector: string;
  offeringType: string;
  status: IpoStatus;
  subscriptionStart: string;
  subscriptionEnd: string;
  refundDate: string;
  listingDate: string;
  confirmedOfferPrice: number | null;
  offerPriceRangeLow: number | null;
  offerPriceRangeHigh: number | null;
  totalShares: number | null;
  publicOfferingShares: number | null;
  tradableShares?: number | null;
  tradableRate?: number | null;
  otcSellPrice?: number | null;
  otcBuyPrice?: number | null;
  underwriters: string[];
  leadManager: string;
  subscriptionCompetitionRate?: number | null;
  competitionRate: number | null;
  lockupRate: number | null;
  institutionalCommitmentRate: number | null;
  expectedMarketCap: number | null;
  description: string;
  highlights: string[];
  risks: string[];
};

type IpoRow = {
  id: string;
  slug: string;
  company_name: string;
  market: string;
  sector: string | null;
  offering_type: string | null;
  status: string | null;
  subscription_start: string;
  subscription_end: string;
  refund_date: string | null;
  listing_date: string | null;
  confirmed_offer_price: number | string | null;
  offer_price_range_low: number | string | null;
  offer_price_range_high: number | string | null;
  total_shares: number | string | null;
  public_offering_shares: number | string | null;
  tradable_shares?: number | string | null;
  tradable_rate?: number | string | null;
  otc_sell_price?: number | string | null;
  otc_buy_price?: number | string | null;
  underwriters: string[] | null;
  lead_manager: string | null;
  subscription_competition_rate?: number | string | null;
  competition_rate: number | string | null;
  lockup_rate: number | string | null;
  institutional_commitment_rate: number | string | null;
  expected_market_cap: number | string | null;
  description: string | null;
  highlights: string[] | null;
  risks: string[] | null;
};

const FEATURED_LIMIT = 3;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const sampleIpos: Ipo[] = [
  {
    id: "sample-hangang-bio-2026",
    slug: "hangang-bio-therapeutics",
    companyName: "한강바이오테라퓨틱스",
    market: "KOSDAQ",
    sector: "바이오",
    offeringType: "신규상장",
    status: "active",
    subscriptionStart: "2026-04-24",
    subscriptionEnd: "2026-04-25",
    refundDate: "2026-04-29",
    listingDate: "2026-05-04",
    confirmedOfferPrice: 26500,
    offerPriceRangeLow: 22000,
    offerPriceRangeHigh: 26000,
    totalShares: 12800000,
    publicOfferingShares: 2200000,
    underwriters: ["미래에셋증권", "한국투자증권"],
    leadManager: "미래에셋증권",
    competitionRate: 812.4,
    lockupRate: 18.7,
    institutionalCommitmentRate: 61.3,
    expectedMarketCap: 339200000000,
    description:
      "세포치료제 플랫폼을 개발하는 것으로 설정한 샘플 공모주 데이터입니다. 데모 화면 구성용 예시이며 실제 투자 정보가 아닙니다.",
    highlights: [
      "기술특례 상장 콘셉트의 샘플 기업",
      "기관 수요예측 호조 시나리오 반영",
      "청약 일정이 오늘 기준 진행 중인 예시",
    ],
    risks: [
      "임상 일정 지연 가능성",
      "실적 가시성보다 기술 기대감 비중이 큼",
      "바이오 업종 변동성 확대 시 수급 약화 가능",
    ],
  },
  {
    id: "sample-daehan-fintech-2026",
    slug: "daehan-fintech-platform",
    companyName: "대한핀테크플랫폼",
    market: "KOSDAQ",
    sector: "핀테크",
    offeringType: "신규상장",
    status: "active",
    subscriptionStart: "2026-04-23",
    subscriptionEnd: "2026-04-24",
    refundDate: "2026-04-28",
    listingDate: "2026-05-06",
    confirmedOfferPrice: 18000,
    offerPriceRangeLow: 15000,
    offerPriceRangeHigh: 18000,
    totalShares: 9800000,
    publicOfferingShares: 1700000,
    underwriters: ["KB증권", "신한투자증권"],
    leadManager: "KB증권",
    competitionRate: 536.2,
    lockupRate: 12.1,
    institutionalCommitmentRate: 44.8,
    expectedMarketCap: 176400000000,
    description:
      "B2B 정산·결제 인프라를 제공하는 것으로 구성한 샘플 데이터입니다. 실제 공모주 일정이나 공시를 대체하지 않습니다.",
    highlights: [
      "매출 반복성이 높은 SaaS형 수익 구조 설정",
      "진행 중 청약 케이스를 위한 예시 일정",
      "복수 주관사 배열 테스트 가능",
    ],
    risks: [
      "대형 고객사 의존도 상승 가능성",
      "규제 변경에 따른 수수료 구조 변동 위험",
      "상장 직후 유통가능 물량 확대 가능성",
    ],
  },
  {
    id: "sample-seoul-ai-2026",
    slug: "seoul-ai-robotics",
    companyName: "서울AI로보틱스",
    market: "KOSDAQ",
    sector: "로봇·자동화",
    offeringType: "신규상장",
    status: "upcoming",
    subscriptionStart: "2026-04-28",
    subscriptionEnd: "2026-04-29",
    refundDate: "2026-05-04",
    listingDate: "2026-05-08",
    confirmedOfferPrice: null,
    offerPriceRangeLow: 28000,
    offerPriceRangeHigh: 32000,
    totalShares: 11000000,
    publicOfferingShares: 2000000,
    underwriters: ["NH투자증권"],
    leadManager: "NH투자증권",
    competitionRate: null,
    lockupRate: null,
    institutionalCommitmentRate: null,
    expectedMarketCap: 352000000000,
    description:
      "스마트팩토리용 비전 로봇 솔루션 기업이라는 가정의 샘플 데이터입니다. 서비스 데모와 UI 검증을 위한 예시입니다.",
    highlights: [
      "청약 임박 상태를 표현하기 위한 샘플",
      "희망 공모가 밴드만 공개된 상태 예시",
      "단일 대표주관사 케이스",
    ],
    risks: [
      "수요예측 결과에 따라 공모가 하단 확정 가능성",
      "설비투자 경기 둔화 시 주문 지연 가능",
      "해외 매출 확대 속도 불확실성",
    ],
  },
  {
    id: "sample-eastwave-2026",
    slug: "eastwave-content-tech",
    companyName: "이스트웨이브콘텐츠테크",
    market: "KOSDAQ",
    sector: "미디어테크",
    offeringType: "신규상장",
    status: "upcoming",
    subscriptionStart: "2026-04-30",
    subscriptionEnd: "2026-05-01",
    refundDate: "2026-05-07",
    listingDate: "2026-05-12",
    confirmedOfferPrice: null,
    offerPriceRangeLow: 13500,
    offerPriceRangeHigh: 16500,
    totalShares: 8700000,
    publicOfferingShares: 1500000,
    underwriters: ["삼성증권", "하나증권"],
    leadManager: "삼성증권",
    competitionRate: null,
    lockupRate: null,
    institutionalCommitmentRate: null,
    expectedMarketCap: 143550000000,
    description:
      "숏폼 제작 자동화 툴을 제공하는 것으로 구성한 샘플 공모주입니다. 운영 데이터가 아닌 예시 레코드입니다.",
    highlights: [
      "콘텐츠 SaaS 섹터 카드 표현용 샘플",
      "청약 예정 상태와 다중 인수단 테스트 가능",
      "설명·리스크 배열 UI 검증에 적합",
    ],
    risks: [
      "광고 경기 둔화 시 고객 예산 축소 가능",
      "AI 생성 콘텐츠 규제 강화 가능성",
      "적자 지속 시 밸류에이션 부담 확대 가능",
    ],
  },
  {
    id: "sample-blueorbit-2026",
    slug: "blueorbit-logistics",
    companyName: "블루오빗로지스틱스",
    market: "KOSPI",
    sector: "물류",
    offeringType: "신규상장",
    status: "upcoming",
    subscriptionStart: "2026-05-06",
    subscriptionEnd: "2026-05-07",
    refundDate: "2026-05-11",
    listingDate: "2026-05-15",
    confirmedOfferPrice: null,
    offerPriceRangeLow: 21000,
    offerPriceRangeHigh: 25000,
    totalShares: 15600000,
    publicOfferingShares: 2600000,
    underwriters: ["한국투자증권", "대신증권"],
    leadManager: "한국투자증권",
    competitionRate: null,
    lockupRate: null,
    institutionalCommitmentRate: null,
    expectedMarketCap: 390000000000,
    description:
      "도심 물류 자동화 설비 기업을 가정한 샘플 상장 일정입니다. 레이아웃과 데이터 가공 테스트 용도로만 사용합니다.",
    highlights: [
      "KOSPI 상장 사례 UI를 위한 샘플",
      "대형 공모 구조처럼 보이도록 수치 구성",
      "다음 달 초 일정 카드 검증용",
    ],
    risks: [
      "대형 설비 수주 지연 시 실적 변동 가능",
      "원가 상승분 전가가 제한될 수 있음",
      "상장 전 재무구조 개선 효과가 제한적일 수 있음",
    ],
  },
  {
    id: "sample-mirae-mobility-2026",
    slug: "mirae-mobility-parts",
    companyName: "미래모빌리티부품",
    market: "KOSDAQ",
    sector: "전장부품",
    offeringType: "신규상장",
    status: "listed",
    subscriptionStart: "2026-04-13",
    subscriptionEnd: "2026-04-14",
    refundDate: "2026-04-16",
    listingDate: "2026-04-22",
    confirmedOfferPrice: 14500,
    offerPriceRangeLow: 12000,
    offerPriceRangeHigh: 14500,
    totalShares: 9400000,
    publicOfferingShares: 1600000,
    underwriters: ["키움증권"],
    leadManager: "키움증권",
    competitionRate: 421.8,
    lockupRate: 9.5,
    institutionalCommitmentRate: 37.4,
    expectedMarketCap: 136300000000,
    description:
      "전기차 열관리 부품 업체라는 설정의 최근 상장 샘플 데이터입니다. 상장 후 상태 화면을 점검하기 위한 예시입니다.",
    highlights: [
      "최근 상장 섹션 구성용 샘플",
      "확정 공모가와 경쟁률이 있는 사례",
      "단일 주관사, 짧은 설명 카드용 데이터",
    ],
    risks: [
      "자동차 업황 둔화 시 고객 발주 감소 가능",
      "주요 고객사 공급망 재편 영향 가능",
      "보호예수 비중이 낮아 초기 변동성 확대 가능",
    ],
  },
  {
    id: "sample-greengrid-2026",
    slug: "greengrid-energy-solution",
    companyName: "그린그리드에너지솔루션",
    market: "KOSDAQ",
    sector: "친환경에너지",
    offeringType: "신규상장",
    status: "listed",
    subscriptionStart: "2026-04-07",
    subscriptionEnd: "2026-04-08",
    refundDate: "2026-04-10",
    listingDate: "2026-04-18",
    confirmedOfferPrice: 23000,
    offerPriceRangeLow: 19000,
    offerPriceRangeHigh: 23000,
    totalShares: 10200000,
    publicOfferingShares: 1800000,
    underwriters: ["신한투자증권", "유진투자증권"],
    leadManager: "신한투자증권",
    competitionRate: 698.1,
    lockupRate: 15.2,
    institutionalCommitmentRate: 58.9,
    expectedMarketCap: 234600000000,
    description:
      "ESS 운영 소프트웨어 기업을 가정한 샘플 최근 상장 건입니다. 실제 공시가 아닌 예시 레코드입니다.",
    highlights: [
      "상장 완료 후 카드/상세 진입 테스트 가능",
      "기관 의무보유 확약 수치가 있는 예시",
      "친환경 섹터 샘플 데이터",
    ],
    risks: [
      "정책 지원 축소 시 프로젝트 지연 가능",
      "수주 인식 시점 차이로 실적 변동 가능",
      "상장 직후 거래량 집중에 따른 주가 변동성 가능",
    ],
  },
  {
    id: "sample-oneday-medical-2026",
    slug: "oneday-medical-device",
    companyName: "원데이메디컬디바이스",
    market: "KOSDAQ",
    sector: "의료기기",
    offeringType: "신규상장",
    status: "listed",
    subscriptionStart: "2026-03-30",
    subscriptionEnd: "2026-03-31",
    refundDate: "2026-04-02",
    listingDate: "2026-04-10",
    confirmedOfferPrice: 9800,
    offerPriceRangeLow: 8500,
    offerPriceRangeHigh: 9800,
    totalShares: 7600000,
    publicOfferingShares: 1400000,
    underwriters: ["대신증권"],
    leadManager: "대신증권",
    competitionRate: 287.6,
    lockupRate: 6.8,
    institutionalCommitmentRate: 24.3,
    expectedMarketCap: 74480000000,
    description:
      "일회용 시술기기를 제조하는 설정의 샘플 최근 상장 건입니다. 목록 정렬과 상세 리스크 표현용 예시입니다.",
    highlights: [
      "소형 딜 규모 샘플",
      "최근 상장 중 상대적으로 이른 일정 예시",
      "보수적인 수요예측 결과 표현 가능",
    ],
    risks: [
      "제품 단가 인하 압력 가능성",
      "해외 인증 일정 지연 가능성",
      "기관 수요예측 흥행 강도가 상대적으로 약함",
    ],
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

function toStringArray(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getTodayIsoInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function deriveStatusFromDates(row: IpoRow): IpoStatus {
  const todayIso = getTodayIsoInSeoul();
  const listingDate = row.listing_date ?? row.subscription_end;

  if (listingDate <= todayIso) {
    return "listed";
  }

  if (
    row.subscription_start <= todayIso &&
    todayIso <= row.subscription_end
  ) {
    return "active";
  }

  return "upcoming";
}

function mapRowToIpo(row: IpoRow): Ipo {
  return {
    id: row.id,
    slug: row.slug,
    companyName: row.company_name,
    market: row.market,
    sector: row.sector ?? "",
    offeringType: row.offering_type ?? "",
    status: deriveStatusFromDates(row),
    subscriptionStart: row.subscription_start,
    subscriptionEnd: row.subscription_end,
    refundDate: row.refund_date ?? row.subscription_end,
    listingDate: row.listing_date ?? row.subscription_end,
    confirmedOfferPrice: toNumber(row.confirmed_offer_price),
    offerPriceRangeLow: toNumber(row.offer_price_range_low),
    offerPriceRangeHigh: toNumber(row.offer_price_range_high),
    totalShares: toNumber(row.total_shares),
    publicOfferingShares: toNumber(row.public_offering_shares),
    tradableShares: toNumber(row.tradable_shares),
    tradableRate: toNumber(row.tradable_rate),
    otcSellPrice: toNumber(row.otc_sell_price),
    otcBuyPrice: toNumber(row.otc_buy_price),
    underwriters: toStringArray(row.underwriters),
    leadManager: row.lead_manager ?? "",
    subscriptionCompetitionRate: toNumber(row.subscription_competition_rate),
    competitionRate: toNumber(row.competition_rate),
    lockupRate: toNumber(row.lockup_rate),
    institutionalCommitmentRate: toNumber(row.institutional_commitment_rate),
    expectedMarketCap: toNumber(row.expected_market_cap),
    description: row.description ?? "",
    highlights: toStringArray(row.highlights),
    risks: toStringArray(row.risks),
  };
}

function sortByFeaturedOrder(ipos: Ipo[]) {
  const today = new Date();
  const statusPriority: Record<IpoStatus, number> = {
    active: 0,
    upcoming: 1,
    listed: 2,
  };

  return [...ipos].sort((left, right) => {
    const statusDiff = statusPriority[left.status] - statusPriority[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (left.status === "listed") {
      const leftListing = left.listingDate ? parseISO(left.listingDate) : today;
      const rightListing = right.listingDate ? parseISO(right.listingDate) : today;
      return differenceInCalendarDays(rightListing, leftListing);
    }

    const leftStart = parseISO(left.subscriptionStart);
    const rightStart = parseISO(right.subscriptionStart);
    return differenceInCalendarDays(leftStart, rightStart);
  });
}

async function fetchIposFromSupabase() {
  const client = createSupabaseServerClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("ipos")
    .select("*")
    .order("subscription_start", { ascending: true });

  if (error) {
    console.error("[lib/ipos] Failed to fetch ipos from Supabase:", error.message);
    return null;
  }

  return (data as IpoRow[]).map(mapRowToIpo);
}

async function fetchIpoBySlugFromSupabase(slug: string) {
  const client = createSupabaseServerClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("ipos")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[lib/ipos] Failed to fetch ipo by slug from Supabase:", error.message);
    return null;
  }

  return data ? mapRowToIpo(data as IpoRow) : undefined;
}

export async function getIpos() {
  if (!hasSupabaseEnv()) {
    return sampleIpos;
  }

  const ipos = await fetchIposFromSupabase();
  return ipos ?? sampleIpos;
}

export async function getIpoBySlug(slug: string) {
  if (!hasSupabaseEnv()) {
    return sampleIpos.find((ipo) => ipo.slug === slug) ?? null;
  }

  const ipo = await fetchIpoBySlugFromSupabase(slug);
  if (ipo === undefined) {
    return null;
  }

  return ipo ?? sampleIpos.find((item) => item.slug === slug) ?? null;
}

export async function getFeaturedIpos(limit = FEATURED_LIMIT) {
  const ipos = await getIpos();
  return sortByFeaturedOrder(ipos).slice(0, limit);
}
