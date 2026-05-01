import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { ExternalDealLink } from "@/components/external-deal-link";
import { IpoCard } from "@/components/ipo-card";
import { getHotDeals, type HotDeal } from "@/lib/hot-deals";
import type { Ipo } from "@/lib/ipos";
import { getIpos } from "@/lib/ipos";
import {
  getListedReturnSnapshot,
  type ListedReturnSnapshot,
} from "@/lib/stock-price";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const allIpos = await getIpos();
  const todayIso = getTodayIsoInSeoul();
  const activeIpos = allIpos
    .filter((ipo) => ipo.status === "active")
    .sort((left, right) => compareIsoDates(left.subscriptionEnd, right.subscriptionEnd));
  const weekSummary = buildWeekSummary(allIpos, todayIso);
  const [listedLeaderboard, todayListings, latestHotDeals] = await Promise.all([
    buildListedLeaderboard(allIpos),
    Promise.all(
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
    ),
    getHotDeals(3),
  ]);

  return (
    <main>
      <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/calendar"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CalendarDays size={17} aria-hidden="true" />
              캘린더 보기
            </Link>
            <Link
              href="/ipos"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              공모주 보기
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/hotdeals"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <BadgePercent size={17} aria-hidden="true" />
              핫딜 보기
            </Link>
          </div>
        </div>
      </section>

      {todayListings.length > 0 ? (
        <TodayListingSection todayIso={todayIso} listings={todayListings} />
      ) : null}

      <WeeklySummarySection todayIso={todayIso} summary={weekSummary} />

      <HotDealsPreviewSection deals={latestHotDeals} />

      {activeIpos.length > 0 ? <ActiveSubscriptionSection ipos={activeIpos} /> : null}

      <ListedLeaderboardSection entries={listedLeaderboard} />
    </main>
  );
}

function WeeklySummarySection({
  todayIso,
  summary,
}: {
  todayIso: string;
  summary: WeekSummary;
}) {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatDate(todayIso)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
              이번 주 핵심 일정
            </h2>
          </div>
          <Link
            href="/calendar"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            전체 일정
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <WeeklySummaryCard
            icon={<TrendingUp size={18} aria-hidden="true" />}
            title="오늘 상장"
            emptyText="오늘 상장 일정 없음"
            ipos={summary.todayListings}
            dateSelector={(ipo) => ipo.listingDate}
            tone="rose"
          />
          <WeeklySummaryCard
            icon={<Clock3 size={18} aria-hidden="true" />}
            title="청약 마감 임박"
            emptyText="이번 주 마감 일정 없음"
            ipos={summary.closingSoon}
            dateSelector={(ipo) => ipo.subscriptionEnd}
            tone="amber"
          />
          <WeeklySummaryCard
            icon={<ListChecks size={18} aria-hidden="true" />}
            title="이번 주 청약 시작"
            emptyText="이번 주 시작 일정 없음"
            ipos={summary.weekStarts}
            dateSelector={(ipo) => ipo.subscriptionStart}
            tone="emerald"
          />
        </div>
      </div>
    </section>
  );
}

function WeeklySummaryCard({
  icon,
  title,
  emptyText,
  ipos,
  dateSelector,
  tone,
}: {
  icon: ReactNode;
  title: string;
  emptyText: string;
  ipos: Ipo[];
  dateSelector: (ipo: Ipo) => string;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneClassName = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-8 items-center justify-center rounded-md border ${toneClassName}`}>
          {icon}
        </span>
        <h3 className="text-base font-semibold text-neutral-950 dark:text-white">{title}</h3>
      </div>

      {ipos.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {ipos.slice(0, 3).map((ipo) => (
            <li key={ipo.id} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
              <Link
                href={`/ipos/${ipo.slug}`}
                className="font-semibold text-neutral-950 hover:text-emerald-700 dark:text-neutral-100 dark:hover:text-emerald-400"
              >
                {ipo.companyName}
              </Link>
              <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {formatDate(dateSelector(ipo))} · {ipo.leadManager || ipo.underwriters[0] || "주관사 미정"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md bg-neutral-50 p-3 text-sm font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          {emptyText}
        </p>
      )}
    </article>
  );
}

function HotDealsPreviewSection({ deals }: { deals: HotDeal[] }) {
  if (deals.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              새로 들어온 할인
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
              최신 핫딜
            </h2>
          </div>
          <Link
            href="/hotdeals"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            핫딜 전체
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {deals.map((deal) => (
            <article
              key={deal.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {formatRelativeTime(deal.publishedAt ?? deal.collectedAt)}
                  </p>
                  <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-neutral-950 dark:text-white">
                    <ExternalDealLink
                      href={deal.dealUrl}
                      className="bg-transparent p-0 text-left font-semibold hover:text-emerald-700 dark:hover:text-emerald-400"
                      ariaLabel={`${deal.title} 상품 보기`}
                    >
                      {deal.title}
                    </ExternalDealLink>
                  </h3>
                </div>
                <ExternalDealLink
                  href={deal.dealUrl}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white p-0 text-neutral-500 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                  ariaLabel={`${deal.title} 상품 열기`}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </ExternalDealLink>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {deal.category ? (
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                    {deal.category}
                  </span>
                ) : null}
                {deal.priceText ? (
                  <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                    {deal.priceText}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActiveSubscriptionSection({ ipos }: { ipos: Ipo[] }) {
  return (
    <section id="active-ipos" className="border-b border-neutral-200 bg-emerald-50/60 dark:border-neutral-800 dark:bg-emerald-950/20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              지금 청약 가능
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
              청약 진행중인 공모주
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            청약 마감일이 가까운 순서로 정리했습니다.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {ipos.map((ipo) => (
            <IpoCard key={ipo.id} ipo={ipo} />
          ))}
        </div>
      </div>
    </section>
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

function ListedLeaderboardSection({
  entries,
}: {
  entries: ListedLeaderboardEntry[];
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            최근 상장 성과
          </p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
            공모가 대비 수익률 순위
          </h2>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          현재가를 확인한 종목 기준
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {entries.slice(0, 6).map(({ ipo, snapshot }, index) => {
          const tone = getReturnTone(snapshot.returnRate);
          const badgeClassName = {
            positive:
              "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300",
            negative:
              "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
            neutral:
              "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
          }[tone];

          return (
            <article
              key={ipo.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    #{index + 1} · {ipo.market}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
                    <Link
                      href={`/ipos/${ipo.slug}`}
                      className="hover:text-emerald-700 dark:hover:text-emerald-400"
                    >
                      {ipo.companyName}
                    </Link>
                  </h3>
                </div>
                <span className={`rounded-md border px-2.5 py-1.5 text-sm font-semibold ${badgeClassName}`}>
                  {formatSignedRate(snapshot.returnRate)}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <TodayListingMetric
                  icon={<CircleDollarSign size={15} aria-hidden="true" />}
                  label="공모가"
                  value={formatMoney(snapshot.offerPrice)}
                />
                <TodayListingMetric
                  icon={<TrendingUp size={15} aria-hidden="true" />}
                  label="현재가"
                  value={formatMoney(snapshot.currentPrice)}
                />
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type WeekSummary = {
  todayListings: Ipo[];
  closingSoon: Ipo[];
  weekStarts: Ipo[];
};

type ListedLeaderboardEntry = {
  ipo: Ipo;
  snapshot: NonNullable<ListedReturnSnapshot>;
};

function buildWeekSummary(ipos: Ipo[], todayIso: string): WeekSummary {
  const weekEndIso = addDaysToIsoDate(todayIso, 6);

  return {
    todayListings: ipos
      .filter((ipo) => getIsoDate(ipo.listingDate) === todayIso)
      .sort((left, right) => left.companyName.localeCompare(right.companyName, "ko-KR")),
    closingSoon: ipos
      .filter(
        (ipo) =>
          isSubscriptionActive(ipo, todayIso) &&
          isIsoDateInRange(ipo.subscriptionEnd, todayIso, weekEndIso),
      )
      .sort((left, right) => compareIsoDates(left.subscriptionEnd, right.subscriptionEnd)),
    weekStarts: ipos
      .filter(
        (ipo) =>
          !isSubscriptionActive(ipo, todayIso) &&
          isIsoDateInRange(ipo.subscriptionStart, todayIso, weekEndIso),
      )
      .sort((left, right) => compareIsoDates(left.subscriptionStart, right.subscriptionStart)),
  };
}

async function buildListedLeaderboard(ipos: Ipo[]): Promise<ListedLeaderboardEntry[]> {
  const listedIpos = ipos
    .filter((ipo) => ipo.status === "listed")
    .sort((left, right) => compareIsoDates(right.listingDate, left.listingDate))
    .slice(0, 12);
  const snapshots = await Promise.all(
    listedIpos.map(async (ipo) => ({
      ipo,
      snapshot: await getListedReturnSnapshot({
        slug: ipo.slug,
        status: ipo.status,
        confirmedOfferPrice: ipo.confirmedOfferPrice,
      }),
    })),
  );

  return snapshots
    .filter(
      (entry): entry is ListedLeaderboardEntry =>
        entry.snapshot !== null && entry.snapshot.returnRate !== null,
    )
    .sort((left, right) => right.snapshot.returnRate - left.snapshot.returnRate);
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

function compareIsoDates(left: string, right: string) {
  return getIsoDate(left).localeCompare(getIsoDate(right));
}

function isIsoDateInRange(value: string, startIso: string, endIso: string) {
  const dateIso = getIsoDate(value);
  return startIso <= dateIso && dateIso <= endIso;
}

function isSubscriptionActive(ipo: Ipo, todayIso: string) {
  return (
    getIsoDate(ipo.subscriptionStart) <= todayIso &&
    todayIso <= getIsoDate(ipo.subscriptionEnd)
  );
}

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${getIsoDate(value)}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "시간 미확인";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return "방금 전";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return formatDate(value);
}

function getReturnTone(value?: number | null) {
  if (value === null || value === undefined || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}
