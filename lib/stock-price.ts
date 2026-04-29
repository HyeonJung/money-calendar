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
  returnRate: number;
  fetchedAt: string;
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
    const [currentPrice, chartPrices] = await Promise.all([
      fetchCurrentPrice(stockCode),
      fetchChartPrices(stockCode),
    ]);
    const effectiveCurrentPrice = currentPrice ?? chartPrices?.latestPrice ?? null;

    if (!effectiveCurrentPrice) {
      return null;
    }

    return {
      stockCode,
      currentPrice: effectiveCurrentPrice,
      offerPrice: confirmedOfferPrice,
      returnRate:
        ((effectiveCurrentPrice - confirmedOfferPrice) / confirmedOfferPrice) * 100,
      fetchedAt: new Date().toISOString(),
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

async function fetchCurrentPrice(stockCode: string) {
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
        }>;
      }>;
    };
  };
  const item = body.result?.areas?.[0]?.datas?.[0];

  return toPositiveNumber(item?.nv ?? item?.sv ?? item?.pcv);
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
