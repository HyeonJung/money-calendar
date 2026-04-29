import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  TrendingUp,
} from "lucide-react";
import { IpoCard } from "@/components/ipo-card";
import type { Ipo } from "@/lib/ipos";
import { getFeaturedIpos, getIpos } from "@/lib/ipos";
import {
  getListedReturnSnapshot,
  type ListedReturnSnapshot,
} from "@/lib/stock-price";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [featuredIpos, allIpos] = await Promise.all([
    getFeaturedIpos(8),
    getIpos(),
  ]);
  const todayIso = getTodayIsoInSeoul();
  const todayListings = await Promise.all(
    allIpos
      .filter((ipo) => getIsoDate(ipo.listingDate) === todayIso)
      .map(async (ipo) => ({
        ipo,
        snapshot: await getListedReturnSnapshot({
          slug: ipo.slug,
          status: ipo.status,
          confirmedOfferPrice: ipo.confirmedOfferPrice,
        }),
      })),
  );

  return (
    <main>
      <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              2026년 4월 한국 공모주 일정
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white sm:text-4xl">
              청약부터 환불, 상장일까지 놓치기 쉬운 공모주 일정을 한곳에서 확인하세요.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
              진행 중인 청약, 임박한 일정, 최근 상장 종목을 우선 노출하고
              상세 페이지에서 공모가, 주관사, 수요예측 지표를 빠르게 비교할 수 있습니다.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/calendar"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CalendarDays size={17} aria-hidden="true" />
              캘린더 보기
            </Link>
            <a
              href="#featured-ipos"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              주요 공모주
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {todayListings.length > 0 ? (
        <TodayListingSection todayIso={todayIso} listings={todayListings} />
      ) : null}

      <section id="featured-ipos" className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950 dark:text-white">
              지금 확인할 공모주
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              청약 중, 청약 임박, 최근 상장 종목을 일정순으로 정리했습니다.
            </p>
          </div>
          <Link
            href="/calendar"
            className="hidden h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 sm:inline-flex"
          >
            <CalendarDays size={16} aria-hidden="true" />
            전체 일정
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {featuredIpos.map((ipo) => (
            <IpoCard key={ipo.id} ipo={ipo} />
          ))}
        </div>
      </section>
    </main>
  );
}

function TodayListingSection({
  todayIso,
  listings,
}: {
  todayIso: string;
  listings: Array<{
    ipo: Ipo;
    snapshot: ListedReturnSnapshot | null;
  }>;
}) {
  return (
    <section className="border-b border-neutral-200 bg-stone-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatDate(todayIso)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
              오늘 상장한 공모주
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            공모가 대비 수익률은 현재가 기준입니다.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map(({ ipo, snapshot }) => (
            <TodayListingCard key={ipo.id} ipo={ipo} snapshot={snapshot} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TodayListingCard({
  ipo,
  snapshot,
}: {
  ipo: Ipo;
  snapshot: ListedReturnSnapshot | null;
}) {
  const returnTone = getReturnTone(snapshot?.returnRate);
  const returnClassName = {
    positive:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    negative:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-300",
    neutral:
      "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
  }[returnTone];

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {ipo.market} · {ipo.sector}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            <Link
              href={`/ipos/${ipo.slug}`}
              className="hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              {ipo.companyName}
            </Link>
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            <Building2 size={15} aria-hidden="true" />
            {ipo.leadManager || ipo.underwriters[0] || "주관사 미정"}
          </p>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-right ${returnClassName}`}>
          <p className="text-xs font-medium opacity-80">공모가 대비</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatSignedRate(snapshot?.returnRate)}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <TodayListingMetric
          icon={<CircleDollarSign size={15} aria-hidden="true" />}
          label="공모가"
          value={formatMoney(snapshot?.offerPrice ?? ipo.confirmedOfferPrice)}
        />
        <TodayListingMetric
          icon={<TrendingUp size={15} aria-hidden="true" />}
          label="현재가"
          value={formatMoney(snapshot?.currentPrice, "미확인")}
        />
        <TodayListingMetric
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="상장일"
          value={formatDate(ipo.listingDate)}
        />
      </dl>
    </article>
  );
}

function TodayListingMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </dd>
    </div>
  );
}

function getTodayIsoInSeoul() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] =
    formatter.formatToParts(new Date());

  return `${year}-${month}-${day}`;
}

function getIsoDate(value: string) {
  return value.slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${getIsoDate(value)}T00:00:00+09:00`));
}

function formatMoney(value?: number | null, fallback = "미정") {
  if (!value) {
    return fallback;
  }

  return `${value.toLocaleString("ko-KR")}원`;
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
