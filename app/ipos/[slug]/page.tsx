import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { IpoCard } from "@/components/ipo-card";
import { ScheduleActions } from "@/components/schedule-actions";
import { StatusBadge } from "@/components/status-badge";
import { SubscriptionCalculator } from "@/components/subscription-calculator";
import { getIpoDocuments, type IpoDocument } from "@/lib/ipo-documents";
import { getIpoBySlug, getIpos, type Ipo } from "@/lib/ipos";
import { getListedReturnSnapshot } from "@/lib/stock-price";

type IpoDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: IpoDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const ipo = await getIpoBySlug(slug);

  if (!ipo) {
    return {
      title: "공모주 상세 | 머니캘린더",
    };
  }

  return {
    title: `${ipo.companyName} | 머니캘린더`,
    description: `${ipo.companyName} 공모주 청약, 환불, 상장 일정을 확인하세요.`,
  };
}

export default async function IpoDetailPage({ params }: IpoDetailPageProps) {
  const { slug } = await params;
  const ipo = await getIpoBySlug(slug);

  if (!ipo) {
    notFound();
  }

  const [listedReturn, allIpos, documents] = await Promise.all([
    getListedReturnSnapshot({
      slug: ipo.slug,
      status: ipo.status,
      confirmedOfferPrice: ipo.confirmedOfferPrice,
    }),
    getIpos(),
    getIpoDocuments(ipo.slug),
  ]);
  const todayIso = getTodayIsoInSeoul();
  const relatedIpos = getRelatedIpos(allIpos, ipo);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/ipos"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        공모주 목록으로
      </Link>

      <section className="mt-5 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={ipo.status}
                subscriptionStart={ipo.subscriptionStart}
                subscriptionEnd={ipo.subscriptionEnd}
                listingDate={ipo.listingDate}
              />
              <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                {ipo.market}
              </span>
              <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                {ipo.sector}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white">
              {ipo.companyName}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
              {ipo.description}
            </p>
          </div>
          <div className="grid min-w-72 grid-cols-2 gap-3">
            <SummaryBox label="확정 공모가" value={formatMoney(ipo.confirmedOfferPrice)} />
            <SummaryBox label="희망 공모가" value={formatRange(ipo.offerPriceRangeLow, ipo.offerPriceRangeHigh)} />
            <SummaryBox label="기관 경쟁률" value={formatRate(ipo.competitionRate, "대 1")} />
            <SummaryBox label="의무보유확약" value={formatRate(ipo.lockupRate, "%")} />
            {ipo.status === "listed" ? (
              <>
                <SummaryBox
                  label="현재가"
                  value={formatMoney(listedReturn?.currentPrice, "미확인")}
                />
                <SummaryBox
                  label="공모가 대비"
                  value={formatSignedRate(listedReturn?.returnRate)}
                  detail={
                    listedReturn
                      ? `공모가 ${formatMoney(listedReturn.offerPrice)}`
                      : "공모가 기준 현재가 미확인"
                  }
                  tone={getReturnTone(listedReturn?.returnRate)}
                />
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <ScheduleTimeline ipo={ipo} todayIso={todayIso} />
        <SourceDocuments ipo={ipo} documents={documents} />
      </div>

      {ipo.status === "listed" ? (
        <ListedMarketOverview ipo={ipo} snapshot={listedReturn} />
      ) : (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">핵심 일정</h2>
              <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
                <InfoRow
                  icon={<CalendarDays size={18} aria-hidden="true" />}
                  label="청약 기간"
                  value={`${formatDate(ipo.subscriptionStart)} - ${formatDate(ipo.subscriptionEnd)}`}
                />
                <InfoRow
                  icon={<CircleDollarSign size={18} aria-hidden="true" />}
                  label="환불일"
                  value={formatDate(ipo.refundDate)}
                />
                <InfoRow
                  icon={<TrendingUp size={18} aria-hidden="true" />}
                  label="상장일"
                  value={formatDate(ipo.listingDate)}
                />
                <InfoRow
                  icon={<Landmark size={18} aria-hidden="true" />}
                  label="대표 주관사"
                  value={ipo.leadManager}
                />
                <InfoRow
                  icon={<Building2 size={18} aria-hidden="true" />}
                  label="인수단"
                  value={ipo.underwriters.join(", ")}
                />
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">공모 정보</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryBox label="총 발행주식수" value={formatShares(ipo.totalShares)} />
                <SummaryBox label="공모주식수" value={formatShares(ipo.publicOfferingShares)} />
                <SummaryBox label="예상 시가총액" value={formatMoney(ipo.expectedMarketCap)} />
                <SummaryBox
                  label="기관 의무보유확약"
                  value={formatRate(ipo.institutionalCommitmentRate, "%")}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <SubscriptionCalculator ipo={ipo} />
            <ScheduleActions ipo={ipo} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <TextList title="투자 포인트" items={ipo.highlights} tone="positive" />
            <TextList title="확인할 리스크" items={ipo.risks} tone="caution" />
          </div>
        </>
      )}

      {relatedIpos.length > 0 ? (
        <section className="mt-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                함께 볼 공모주
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                비슷한 일정과 시장
              </h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {relatedIpos.map((item) => (
              <IpoCard key={item.id} ipo={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ScheduleTimeline({ ipo, todayIso }: { ipo: Ipo; todayIso: string }) {
  const steps = [
    { key: "subscription-start", label: "청약 시작", date: ipo.subscriptionStart },
    { key: "subscription-end", label: "청약 종료", date: ipo.subscriptionEnd },
    { key: "refund", label: "환불", date: ipo.refundDate },
    { key: "listing", label: "상장", date: ipo.listingDate },
  ];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">상세 일정 타임라인</h2>
      </div>

      <ol className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const state = getTimelineState(step.date, todayIso);
          const isLast = index === steps.length - 1;

          return (
            <li key={step.key} className="relative flex gap-3">
              {!isLast ? (
                <span className="absolute left-[15px] top-8 h-[calc(100%+0.5rem)] w-px bg-neutral-200 dark:bg-neutral-800" />
              ) : null}
              <span
                className={[
                  "relative z-10 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state.className,
                ].join(" ")}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 rounded-md bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
                <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-100">
                  {step.label}
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {formatDate(step.date)} · {state.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SourceDocuments({
  ipo,
  documents,
}: {
  ipo: Ipo;
  documents: IpoDocument[];
}) {
  const dartSearchUrl = `https://dart.fss.or.kr/dsab007/search.ax?textCrpNM=${encodeURIComponent(
    ipo.companyName,
  )}`;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <FileText size={18} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">근거 문서</h2>
      </div>

      {documents.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {documents.slice(0, 4).map((document) => (
            <li key={document.id} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1.5 text-sm font-semibold text-neutral-950 hover:text-emerald-700 dark:text-neutral-100 dark:hover:text-emerald-400"
              >
                {document.title}
                <ExternalLink size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              </a>
              <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {document.source} · {document.rceptNo} · {formatDateTime(document.fetchedAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-md bg-neutral-50 p-4 dark:bg-neutral-900">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            저장된 DART 문서는 아직 없습니다.
          </p>
          <a
            href={dartSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            DART에서 검색
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  );
}

function ListedMarketOverview({
  ipo,
  snapshot,
}: {
  ipo: Awaited<ReturnType<typeof getIpoBySlug>>;
  snapshot: Awaited<ReturnType<typeof getListedReturnSnapshot>>;
}) {
  if (!ipo) {
    return null;
  }

  const returnTone = getReturnTone(snapshot?.returnRate);
  const returnTextClassName = getReturnTextClassName(returnTone);

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-950 text-white shadow-sm shadow-black/10 dark:border-neutral-800">
      <div className="grid gap-px bg-neutral-800 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-neutral-950 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-400">
            <span className="rounded-md bg-blue-600 px-2 py-1 text-white">
              {ipo.market}
            </span>
            {snapshot?.stockCode ? <span>{snapshot.stockCode}</span> : null}
            <span>{ipo.sector}</span>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-400">현재가</p>
              <p className="mt-1 text-4xl font-semibold tracking-normal text-white">
                {formatMoney(snapshot?.currentPrice, "현재가 미확인")}
              </p>
              <p className={`mt-2 text-base font-semibold ${returnTextClassName}`}>
                공모가보다 {formatSignedMoney(snapshot?.returnAmount)}{" "}
                {formatSignedRate(snapshot?.returnRate)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm">
              <p className="text-neutral-400">공모가</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatMoney(snapshot?.offerPrice ?? ipo.confirmedOfferPrice)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <PriceTrendChart snapshot={snapshot} />
          </div>

          <div className="mt-6">
            <PriceRangeBar snapshot={snapshot} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <DarkMetric label="시가" value={formatMoney(snapshot?.openPrice, "미확인")} />
            <DarkMetric label="고가" value={formatMoney(snapshot?.highPrice, "미확인")} />
            <DarkMetric label="저가" value={formatMoney(snapshot?.lowPrice, "미확인")} />
          </div>
        </div>

        <div className="bg-neutral-950 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-400">상장 후 시세 정보</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                공모가 대비 수익률
              </h2>
            </div>
            <span className={`rounded-lg border px-3 py-2 text-right text-lg font-semibold ${getReturnBadgeClassName(returnTone)}`}>
              {formatSignedRate(snapshot?.returnRate)}
            </span>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <DarkMetric label="거래량" value={formatNumber(snapshot?.volume, "미확인")} />
            <DarkMetric label="거래대금" value={formatMoney(snapshot?.tradeAmount, "미확인")} />
            <DarkMetric label="시가총액" value={formatMoney(snapshot?.marketCap, "미확인")} />
            <DarkMetric label="상장주식수" value={formatShares(snapshot?.listedShares)} />
            <DarkMetric label="상장일" value={formatDate(ipo.listingDate)} />
            <DarkMetric label="대표 주관사" value={ipo.leadManager || "미정"} />
          </dl>

          <div className="mt-5 rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
            <p className="text-xs font-medium text-neutral-500">기준</p>
            <p className="mt-1 text-sm leading-6 text-neutral-300">
              수익률은 확정 공모가와 현재가를 비교해 계산합니다.
              {snapshot
                ? ` 최근 갱신 시각은 ${formatDateTime(snapshot.fetchedAt)}입니다.`
                : " 현재가를 확인하지 못해 수익률을 계산할 수 없습니다."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceTrendChart({
  snapshot,
}: {
  snapshot: Awaited<ReturnType<typeof getListedReturnSnapshot>>;
}) {
  const chartPrices = snapshot?.chartPrices ?? [];
  const values = chartPrices.map((point) => point.close);
  const offerPrice = snapshot?.offerPrice ?? null;

  if (values.length === 0) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-sm font-medium text-neutral-500">
        차트 데이터 미확인
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const padding = {
    top: 18,
    right: 24,
    bottom: 34,
    left: 54,
  };
  const allValues = offerPrice ? [...values, offerPrice] : values;
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const valuePadding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.02, 1);
  const minValue = rawMin - valuePadding;
  const maxValue = rawMax + valuePadding;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) =>
    padding.left +
    (values.length === 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
  const yFor = (value: number) =>
    padding.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const polylinePoints = chartPrices
    .map((point, index) => `${xFor(index).toFixed(2)},${yFor(point.close).toFixed(2)}`)
    .join(" ");
  const fillPoints =
    values.length > 1
      ? `${padding.left},${height - padding.bottom} ${polylinePoints} ${
          width - padding.right
        },${height - padding.bottom}`
      : "";
  const firstPoint = chartPrices[0];
  const lastPoint = chartPrices[chartPrices.length - 1];
  const offerY =
    offerPrice && offerPrice >= minValue && offerPrice <= maxValue
      ? yFor(offerPrice)
      : null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-200">가격 추이</p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatChartPointLabel(firstPoint?.date)} - {formatChartPointLabel(lastPoint?.date)}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <p>최고 {formatMoney(rawMax)}</p>
          <p className="mt-1">최저 {formatMoney(rawMin)}</p>
        </div>
      </div>

      <svg
        className="mt-4 block h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${formatChartPointLabel(firstPoint?.date)}부터 ${formatChartPointLabel(
          lastPoint?.date,
        )}까지 가격 추이 차트`}
      >
        {[0, 1, 2, 3].map((index) => {
          const y = padding.top + (index / 3) * plotHeight;

          return (
            <line
              key={index}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="rgb(38 38 38)"
              strokeWidth="1"
            />
          );
        })}

        {[rawMin, rawMax].map((value) => (
          <text
            key={value}
            x={padding.left - 10}
            y={yFor(value) + 4}
            textAnchor="end"
            className="fill-neutral-500 text-[11px] font-medium"
          >
            {formatCompactPrice(value)}
          </text>
        ))}

        {offerY !== null ? (
          <>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={offerY}
              y2={offerY}
              stroke="rgb(16 185 129)"
              strokeDasharray="5 5"
              strokeWidth="1.5"
            />
            <text
              x={width - padding.right}
              y={offerY - 7}
              textAnchor="end"
              className="fill-emerald-400 text-[11px] font-semibold"
            >
              공모가 {formatCompactPrice(offerPrice)}
            </text>
          </>
        ) : null}

        {fillPoints ? (
          <polygon points={fillPoints} fill="url(#price-area-gradient)" opacity="0.22" />
        ) : null}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="rgb(244 63 94)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {values.length === 1 ? (
          <circle
            cx={xFor(0)}
            cy={yFor(values[0])}
            r="5"
            className="fill-rose-400"
          />
        ) : null}
        <circle
          cx={xFor(chartPrices.length - 1)}
          cy={yFor(lastPoint.close)}
          r="4.5"
          className="fill-rose-400"
        />
        <text
          x={padding.left}
          y={height - 9}
          className="fill-neutral-500 text-[11px] font-medium"
        >
          {formatChartPointLabel(firstPoint?.date)}
        </text>
        <text
          x={width - padding.right}
          y={height - 9}
          textAnchor="end"
          className="fill-neutral-500 text-[11px] font-medium"
        >
          {formatChartPointLabel(lastPoint?.date)}
        </text>
        <defs>
          <linearGradient id="price-area-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(244 63 94)" />
            <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function PriceRangeBar({
  snapshot,
}: {
  snapshot: Awaited<ReturnType<typeof getListedReturnSnapshot>>;
}) {
  const low = snapshot?.lowPrice ?? null;
  const high = snapshot?.highPrice ?? null;
  const current = snapshot?.currentPrice ?? null;
  const currentPercent =
    low && high && current && high > low
      ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
      : null;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
        <span>일중 저가 {formatMoney(low, "미확인")}</span>
        <span>일중 고가 {formatMoney(high, "미확인")}</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-neutral-800">
        <div className="absolute inset-x-0 inset-y-0 rounded-full bg-gradient-to-r from-blue-500 via-neutral-500 to-rose-500" />
        {currentPercent !== null ? (
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500 shadow"
            style={{ left: `${currentPercent}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-neutral-100">{value}</dd>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueClassName = {
    positive: "text-rose-700 dark:text-rose-300",
    negative: "text-sky-700 dark:text-sky-300",
    neutral: "text-neutral-950 dark:text-neutral-100",
  }[tone];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueClassName}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p> : null}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-neutral-100">{value}</p>
      </div>
    </div>
  );
}

function TextList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "caution";
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <ShieldCheck
          size={18}
          aria-hidden="true"
          className={tone === "positive" ? "text-emerald-700" : "text-amber-700"}
        />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-neutral-50 p-3 text-sm leading-6 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function getTodayIsoInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getTimelineState(value: string, todayIso: string) {
  const isoDate = value.slice(0, 10);

  if (isoDate < todayIso) {
    return {
      label: "완료",
      className:
        "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
    };
  }

  if (isoDate === todayIso) {
    return {
      label: "오늘",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }

  return {
    label: "예정",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
  };
}

function getRelatedIpos(ipos: Ipo[], currentIpo: Ipo) {
  return ipos
    .filter((ipo) => ipo.slug !== currentIpo.slug)
    .map((ipo) => ({
      ipo,
      score:
        (ipo.market === currentIpo.market ? 3 : 0) +
        (ipo.sector === currentIpo.sector ? 2 : 0) +
        getDateProximityScore(ipo.listingDate, currentIpo.listingDate) +
        getDateProximityScore(ipo.subscriptionStart, currentIpo.subscriptionStart),
    }))
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.ipo.listingDate.localeCompare(right.ipo.listingDate);
    })
    .slice(0, 3)
    .map((entry) => entry.ipo);
}

function getDateProximityScore(leftValue: string, rightValue: string) {
  const left = new Date(`${leftValue.slice(0, 10)}T00:00:00+09:00`).getTime();
  const right = new Date(`${rightValue.slice(0, 10)}T00:00:00+09:00`).getTime();

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return 0;
  }

  const diffDays = Math.abs(left - right) / 86_400_000;

  if (diffDays <= 7) {
    return 3;
  }

  if (diffDays <= 21) {
    return 2;
  }

  if (diffDays <= 45) {
    return 1;
  }

  return 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatMoney(value?: number | null, fallback = "미정") {
  if (!value) {
    return fallback;
  }

  if (value >= 100000000) {
    return `${Math.round(value / 100000000).toLocaleString("ko-KR")}억원`;
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function formatRange(low?: number | null, high?: number | null) {
  if (!low || !high) {
    return "미정";
  }

  return `${low.toLocaleString("ko-KR")}원 - ${high.toLocaleString("ko-KR")}원`;
}

function formatRate(value?: number | null, unit = "") {
  if (value === null || value === undefined) {
    return "미정";
  }

  return `${value.toLocaleString("ko-KR")}${unit}`;
}

function formatShares(value?: number | null) {
  if (!value) {
    return "미정";
  }

  return `${value.toLocaleString("ko-KR")}주`;
}

function formatNumber(value?: number | null, fallback = "미정") {
  if (!value) {
    return fallback;
  }

  return value.toLocaleString("ko-KR");
}

function formatCompactPrice(value?: number | null) {
  if (!value) {
    return "-";
  }

  return value.toLocaleString("ko-KR");
}

function formatChartPointLabel(value?: string) {
  if (!value) {
    return "-";
  }

  if (/^\d{12}$/.test(value)) {
    return `${Number(value.slice(8, 10))}:${value.slice(10, 12)}`;
  }

  if (/^\d{8}$/.test(value)) {
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));

    return `${month}.${day}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatSignedRate(value?: number | null) {
  if (value === null || value === undefined) {
    return "미확인";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedMoney(value?: number | null) {
  if (value === null || value === undefined) {
    return "미확인";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getReturnTone(value?: number | null) {
  if (value === null || value === undefined || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

function getReturnTextClassName(tone: "positive" | "negative" | "neutral") {
  return {
    positive: "text-rose-400",
    negative: "text-sky-400",
    neutral: "text-neutral-300",
  }[tone];
}

function getReturnBadgeClassName(tone: "positive" | "negative" | "neutral") {
  return {
    positive: "border-rose-900/70 bg-rose-950/60 text-rose-300",
    negative: "border-sky-900/70 bg-sky-950/60 text-sky-300",
    neutral: "border-neutral-800 bg-neutral-900 text-neutral-300",
  }[tone];
}
