import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getIpoBySlug } from "@/lib/ipos";
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
      title: "공모주 상세 | 공모주 캘린더",
    };
  }

  return {
    title: `${ipo.companyName} | 공모주 캘린더`,
    description: `${ipo.companyName} 공모주 청약, 환불, 상장 일정을 확인하세요.`,
  };
}

export default async function IpoDetailPage({ params }: IpoDetailPageProps) {
  const { slug } = await params;
  const ipo = await getIpoBySlug(slug);

  if (!ipo) {
    notFound();
  }

  const listedReturn = await getListedReturnSnapshot({
    slug: ipo.slug,
    status: ipo.status,
    confirmedOfferPrice: ipo.confirmedOfferPrice,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        목록으로
      </Link>

      <section className="mt-5 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ipo.status} />
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
        <TextList title="투자 포인트" items={ipo.highlights} tone="positive" />
        <TextList title="확인할 리스크" items={ipo.risks} tone="caution" />
      </div>
    </main>
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
    positive: "text-emerald-700 dark:text-emerald-300",
    negative: "text-rose-700 dark:text-rose-300",
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

function formatSignedRate(value?: number | null) {
  if (value === null || value === undefined) {
    return "미확인";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function getReturnTone(value?: number | null) {
  if (value === null || value === undefined || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}
