import "server-only";

const DART_BASE_URL = "https://opendart.fss.or.kr/api";
const DART_VIEWER_BASE_URL = "https://dart.fss.or.kr/dsaf001/main.do";
const FETCH_TIMEOUT_MS = 12000;

export type DartEnrichmentInput = {
  companyName: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  market: string;
  sector: string;
};

export type DartDocument = {
  source: "DART";
  rceptNo: string;
  title: string;
  url: string;
  fetchedAt: string;
};

export type DartEnrichmentResult = {
  companySummary: string;
  businessModel: string;
  investmentPoints: string[];
  riskPoints: string[];
  sourceNotes: string[];
  sourceConfidence: number;
  documents: DartDocument[];
  warnings: string[];
  errors: string[];
};

type DartListItem = {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  corp_cls?: string;
  report_nm?: string;
  rcept_no?: string;
  flr_nm?: string;
  rcept_dt?: string;
  rm?: string;
};

type DartListResponse = {
  status?: string;
  message?: string;
  list?: DartListItem[];
};

type DartCompanyResponse = {
  status?: string;
  message?: string;
  corp_name?: string;
  corp_name_eng?: string;
  stock_name?: string;
  stock_code?: string;
  ceo_nm?: string;
  corp_cls?: string;
  jurir_no?: string;
  bizr_no?: string;
  adres?: string;
  hm_url?: string;
  ir_url?: string;
  phn_no?: string;
  fax_no?: string;
  induty_code?: string;
  est_dt?: string;
  acc_mt?: string;
};

export async function enrichIpoFromDart(
  input: DartEnrichmentInput,
): Promise<DartEnrichmentResult | null> {
  const apiKey = process.env.OPENDART_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const filings = await searchIpoFilings(apiKey, input.companyName).catch(
    (error: unknown) => {
      errors.push(`DART 공시검색 실패: ${toErrorMessage(error)}`);
      return [];
    },
  );

  if (filings.length === 0) {
    warnings.push(`${input.companyName} 관련 DART IPO 공시를 찾지 못했습니다.`);
  }

  const primaryFiling = pickPrimaryFiling(filings);
  const company = primaryFiling?.corp_code
    ? await fetchCompany(apiKey, primaryFiling.corp_code).catch((error: unknown) => {
        warnings.push(`DART 기업개황 조회 실패: ${toErrorMessage(error)}`);
        return null;
      })
    : null;

  const documents = filings.slice(0, 5).map((filing) => ({
    source: "DART" as const,
    rceptNo: filing.rcept_no ?? "",
    title: filing.report_nm ?? "DART 공시",
    url: `${DART_VIEWER_BASE_URL}?rcpNo=${filing.rcept_no}`,
    fetchedAt: new Date().toISOString(),
  })).filter((document) => document.rceptNo);

  const companySummary = buildCompanySummary(input, company, primaryFiling);
  const businessModel = buildBusinessModel(input, company);
  const investmentPoints = buildInvestmentPoints(input, company, primaryFiling);
  const riskPoints = buildRiskPoints(input, primaryFiling);
  const sourceNotes = buildSourceNotes(company, documents, warnings);
  const sourceConfidence = scoreConfidence(company, documents);

  return {
    companySummary,
    businessModel,
    investmentPoints,
    riskPoints,
    sourceNotes,
    sourceConfidence,
    documents,
    warnings,
    errors,
  };
}

async function searchIpoFilings(apiKey: string, companyName: string) {
  const endDate = formatDateParam(new Date());
  const beginDate = shiftYearDateParam(-2);
  const params = new URLSearchParams({
    crtfc_key: apiKey,
    bgn_de: beginDate,
    end_de: endDate,
    page_no: "1",
    page_count: "100",
    sort: "date",
    sort_mth: "desc",
  });

  const response = await fetchJson<DartListResponse>(`/list.json?${params}`);

  if (response.status && response.status !== "000") {
    throw new Error(response.message ?? `DART status ${response.status}`);
  }

  const normalizedTarget = normalizeCompanyName(companyName);

  return (response.list ?? []).filter((item) => {
    const name = normalizeCompanyName(item.corp_name ?? "");
    const report = item.report_nm ?? "";
    return (
      nameMatches(name, normalizedTarget) &&
      /(증권신고서|투자설명서|발행조건확정|정정신고서)/.test(report)
    );
  });
}

async function fetchCompany(apiKey: string, corpCode: string) {
  const params = new URLSearchParams({
    crtfc_key: apiKey,
    corp_code: corpCode,
  });
  const response = await fetchJson<DartCompanyResponse>(`/company.json?${params}`);

  if (response.status && response.status !== "000") {
    throw new Error(response.message ?? `DART status ${response.status}`);
  }

  return response;
}

async function fetchJson<T>(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${DART_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function pickPrimaryFiling(filings: DartListItem[]) {
  return (
    filings.find((filing) => /증권신고서/.test(filing.report_nm ?? "")) ??
    filings.find((filing) => /투자설명서/.test(filing.report_nm ?? "")) ??
    filings[0] ??
    null
  );
}

function buildCompanySummary(
  input: DartEnrichmentInput,
  company: DartCompanyResponse | null,
  filing: DartListItem | null,
) {
  const stockName = company?.stock_name || input.companyName;
  const market = normalizeMarketLabel(input.market);
  const ceo = company?.ceo_nm ? ` 대표자는 ${company.ceo_nm}입니다.` : "";
  const homepage = company?.hm_url ? ` 홈페이지는 ${company.hm_url}입니다.` : "";
  const filingNote = filing?.report_nm
    ? ` 최근 확인한 공시는 ${filing.report_nm}입니다.`
    : "";

  return `${stockName}는 ${market} 상장을 추진하는 ${input.sector || "업종 미확인"} 기업입니다.${ceo}${homepage}${filingNote}`.trim();
}

function buildBusinessModel(
  input: DartEnrichmentInput,
  company: DartCompanyResponse | null,
) {
  const sector = input.sector || "업종 미확인";
  const address = company?.adres ? ` 소재지는 ${company.adres}입니다.` : "";
  const industryCode = company?.induty_code
    ? ` DART 업종코드는 ${company.induty_code}입니다.`
    : "";

  return `${input.companyName}의 사업 영역은 ${sector}로 분류됩니다.${address}${industryCode} 사업 세부 내용은 증권신고서와 투자설명서 원문 확인이 필요합니다.`.trim();
}

function buildInvestmentPoints(
  input: DartEnrichmentInput,
  company: DartCompanyResponse | null,
  filing: DartListItem | null,
) {
  const points = [
    `${input.sector || "해당 업종"} 업종의 공모주로, 업종 성장성과 비교기업 밸류에이션 확인이 필요합니다.`,
    `${input.subscriptionStart}~${input.subscriptionEnd} 청약 일정이 공개되어 자금 배정 일정을 세울 수 있습니다.`,
    filing?.report_nm
      ? `${filing.report_nm} 공시가 확인되어 공모 구조와 투자위험요소를 원문으로 검증할 수 있습니다.`
      : null,
    company?.hm_url
      ? `회사 홈페이지가 확인되어 제품·서비스와 IR 자료 교차검증이 가능합니다.`
      : null,
  ];

  return points.filter(Boolean).slice(0, 4) as string[];
}

function buildRiskPoints(input: DartEnrichmentInput, filing: DartListItem | null) {
  const points = [
    "공모 일정, 공모가, 상장일은 정정신고서와 시장 상황에 따라 변경될 수 있습니다.",
    "투자위험요소는 DART 증권신고서 원문에서 반드시 확인해야 합니다.",
    `${input.sector || "해당 업종"} 업황 변동과 상장 직후 유통 물량에 따른 가격 변동성이 존재합니다.`,
    filing?.rm ? `DART 비고: ${filing.rm}` : null,
  ];

  return points.filter(Boolean).slice(0, 4) as string[];
}

function buildSourceNotes(
  company: DartCompanyResponse | null,
  documents: DartDocument[],
  warnings: string[],
) {
  const notes = [
    company?.corp_name ? `DART 기업개황: ${company.corp_name}` : null,
    documents.length > 0
      ? `DART 공시 ${documents.length}건 확인: ${documents
          .slice(0, 2)
          .map((document) => document.title)
          .join(", ")}`
      : null,
    ...warnings,
  ];

  return notes.filter(Boolean).slice(0, 6) as string[];
}

function scoreConfidence(company: DartCompanyResponse | null, documents: DartDocument[]) {
  let score = 0.35;

  if (company?.corp_name) {
    score += 0.25;
  }

  if (documents.length > 0) {
    score += 0.25;
  }

  if (documents.some((document) => /증권신고서|투자설명서/.test(document.title))) {
    score += 0.15;
  }

  return Math.min(1, Number(score.toFixed(3)));
}

function formatDateParam(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function shiftYearDateParam(offset: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + offset);
  return formatDateParam(date);
}

function normalizeMarketLabel(market: string) {
  if (/KOSPI|유가/.test(market)) {
    return "유가증권시장";
  }

  if (/KONEX|코넥스/.test(market)) {
    return "코넥스";
  }

  return "코스닥";
}

function normalizeCompanyName(value: string) {
  return value
    .replace(/\(주\)|주식회사|\s|\(구\.[^)]+\)|[㈜()（）.,·ㆍ-]/g, "")
    .toLowerCase();
}

function nameMatches(candidate: string, target: string) {
  if (!candidate || !target) {
    return false;
  }

  return candidate.includes(target) || target.includes(candidate);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
