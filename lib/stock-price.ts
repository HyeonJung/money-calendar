import "server-only";

const NAVER_REALTIME_URL = "https://polling.finance.naver.com/api/realtime";
const NAVER_CHART_URL = "https://fchart.stock.naver.com/sise.nhn";
const FETCH_TIMEOUT_MS = 8_000;
const RECENT_TRADING_DAYS = 180;

type ListedReturnInput = {
  slug: string;
  status: string;
  confirmedOfferPrice: number | null;
};

export type ListedReturnSnapshot = {
  stockCode: string;
  currentPrice: number;
  offerPrice: number;
  returnAmount: number;
  returnRate: number;
  previousClose: number | null;
  dayChange: number | null;
  dayChangeRate: number | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  upperLimitPrice: number | null;
  lowerLimitPrice: number | null;
  volume: number | null;
  tradeAmount: number | null;
  listedShares: number | null;
  marketCap: number | null;
  fetchedAt: string;
  source: "realtime" | "chart";
};

type RealtimeQuote = {
  currentPrice: number;
  previousClose: number | null;
  dayChange: number | null;
  dayChangeRate: number | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  upperLimitPrice: number | null;
  lowerLimitPrice: number | null;
  volume: number | null;
  tradeAmount: number | null;
  listedShares: number | null;
  marketCap: number | null;
};

export async function getListedReturnSnapshot({
  slug,
  status,
  confirmedOfferPrice,
}: ListedReturnInput): Promise<ListedReturnSnapshot | null> {
  if (status !== "listed") {
    return null;
  }

  if (!confirmedOfferPrice || confirmedOfferPrice <= 0) {
    return null;
  }

  const stockCode = extractStockCodeFromSlug(slug);
  if (!stockCode) {
    return null;
  }

  try {
    const [realtimeQuote, chartPrices] = await Promise.all([
      fetchRealtimeQuote(stockCode),
      fetchChartPrices(stockCode),
    ]);
    const effectiveCurrentPrice =
      realtimeQuote?.currentPrice ?? chartPrices?.latestPrice ?? null;

    if (!effectiveCurrentPrice) {
      return null;
    }
    const returnAmount = effectiveCurrentPrice - confirmedOfferPrice;

    return {
      stockCode,
      currentPrice: effectiveCurrentPrice,
      offerPrice: confirmedOfferPrice,
      returnAmount,
      returnRate: (returnAmount / confirmedOfferPrice) * 100,
      previousClose: realtimeQuote?.previousClose ?? null,
      dayChange: realtimeQuote?.dayChange ?? null,
      dayChangeRate: realtimeQuote?.dayChangeRate ?? null,
      openPrice: realtimeQuote?.openPrice ?? null,
      highPrice: realtimeQuote?.highPrice ?? null,
      lowPrice: realtimeQuote?.lowPrice ?? null,
      upperLimitPrice: realtimeQuote?.upperLimitPrice ?? null,
      lowerLimitPrice: realtimeQuote?.lowerLimitPrice ?? null,
      volume: realtimeQuote?.volume ?? null,
      tradeAmount: realtimeQuote?.tradeAmount ?? null,
      listedShares: realtimeQuote?.listedShares ?? null,
      marketCap: realtimeQuote?.marketCap ?? null,
      fetchedAt: new Date().toISOString(),
      source: realtimeQuote ? "realtime" : "chart",
    };
  } catch (error) {
    console.error("[lib/stock-price] Failed to fetch listed return snapshot:", error);
    return null;
  }
}

function extractStockCodeFromSlug(slug: string) {
  const match = slug.match(/^ipo-([0-9a-z]{6})$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

async function fetchRealtimeQuote(stockCode: string): Promise<RealtimeQuote | null> {
  const url = new URL(NAVER_REALTIME_URL);
  url.searchParams.set("query", `SERVICE_ITEM:${stockCode}`);

  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "user-agent": "Mozilla/5.0 (compatible; korea-ipo-calendar/1.0)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    result?: {
      areas?: Array<{
        datas?: Array<{
          nv?: number | string | null;
          sv?: number | string | null;
          pcv?: number | string | null;
          cv?: number | string | null;
          cr?: number | string | null;
          ov?: number | string | null;
          hv?: number | string | null;
          lv?: number | string | null;
          ul?: number | string | null;
          ll?: number | string | null;
          aq?: number | string | null;
          aa?: number | string | null;
          countOfListedStock?: number | string | null;
        }>;
      }>;
    };
  };
  const item = body.result?.areas?.[0]?.datas?.[0];
  const currentPrice = toPositiveNumber(item?.nv ?? item?.sv ?? item?.pcv);

  if (!currentPrice) {
    return null;
  }

  const listedShares = toPositiveNumber(item?.countOfListedStock);

  return {
    currentPrice,
    previousClose: toPositiveNumber(item?.pcv),
    dayChange: toFiniteNumber(item?.cv),
    dayChangeRate: toFiniteNumber(item?.cr),
    openPrice: toPositiveNumber(item?.ov),
    highPrice: toPositiveNumber(item?.hv),
    lowPrice: toPositiveNumber(item?.lv),
    upperLimitPrice: toPositiveNumber(item?.ul),
    lowerLimitPrice: toPositiveNumber(item?.ll),
    volume: toPositiveNumber(item?.aq),
    tradeAmount: toPositiveNumber(item?.aa),
    listedShares,
    marketCap: listedShares ? currentPrice * listedShares : null,
  };
}

async function fetchChartPrices(stockCode: string) {
  const url = new URL(NAVER_CHART_URL);
  url.searchParams.set("symbol", stockCode);
  url.searchParams.set("timeframe", "day");
  url.searchParams.set("count", String(RECENT_TRADING_DAYS));
  url.searchParams.set("requestType", "0");

  const response = await fetch(url, {
    headers: {
      accept: "application/xml,text/xml,*/*",
      "user-agent": "Mozilla/5.0 (compatible; korea-ipo-calendar/1.0)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return null;
  }

  const xml = await response.text();
  const items = parseChartItems(xml);
  if (items.length === 0) {
    return null;
  }

  const latestItem = items[items.length - 1];

  return {
    latestPrice: toPositiveNumber(latestItem.close),
  };
}

function parseChartItems(xml: string) {
  const itemPattern = /<item\s+data="([^"]+)"/g;
  const items: Array<{ date: string; close: number }> = [];

  for (const match of xml.matchAll(itemPattern)) {
    const [date, , , , close] = match[1].split("|");
    const parsedClose = toPositiveNumber(close);

    if (date && parsedClose) {
      items.push({ date, close: parsedClose });
    }
  }

  return items;
}

function toPositiveNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
