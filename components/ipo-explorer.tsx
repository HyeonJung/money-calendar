"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { Ipo } from "@/lib/ipos";

type IpoExplorerProps = {
  ipos: Ipo[];
  todayIso: string;
};

type StatusFilter =
  | "all"
  | "active"
  | "subscriptionUpcoming"
  | "listingUpcoming"
  | "listed"
  | "bookmarked";

type SortKey = "featured" | "subscriptionEnd" | "listingDate" | "companyName";

const BOOKMARK_STORAGE_KEY = "money-calendar-bookmarks";
const LEGACY_BOOKMARK_STORAGE_KEY = "korea-ipo-calendar-bookmarks";
const BOOKMARK_EVENT_NAME = "money-calendar-bookmarks-change";

export function IpoExplorer({ ipos, todayIso }: IpoExplorerProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [underwriterFilter, setUnderwriterFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("featured");
  const bookmarkSnapshot = useSyncExternalStore(
    subscribeBookmarkStorage,
    readBookmarkSnapshot,
    getServerBookmarkSnapshot,
  );
  const bookmarks = useMemo(() => parseBookmarkSnapshot(bookmarkSnapshot), [bookmarkSnapshot]);

  const markets = useMemo(
    () => uniqueSorted(ipos.map((ipo) => ipo.market).filter(Boolean)),
    [ipos],
  );
  const underwriters = useMemo(
    () =>
      uniqueSorted(
        ipos.flatMap((ipo) => [
          ipo.leadManager,
          ...ipo.underwriters,
        ]).filter(Boolean),
      ),
    [ipos],
  );

  const filteredIpos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ipos
      .filter((ipo) => {
        if (statusFilter === "bookmarked" && !bookmarks.has(ipo.slug)) {
          return false;
        }

        if (statusFilter !== "all" && statusFilter !== "bookmarked") {
          const scheduleStatus = getScheduleStatus(ipo, todayIso);
          if (scheduleStatus.kind !== statusFilter) {
            return false;
          }
        }

        if (marketFilter !== "all" && ipo.market !== marketFilter) {
          return false;
        }

        if (
          underwriterFilter !== "all" &&
          ipo.leadManager !== underwriterFilter &&
          !ipo.underwriters.includes(underwriterFilter)
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const searchableText = [
          ipo.companyName,
          ipo.market,
          ipo.sector,
          ipo.leadManager,
          ...ipo.underwriters,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sortKey === "featured") {
          return compareFeaturedOrder(left, right);
        }

        if (sortKey === "companyName") {
          return left.companyName.localeCompare(right.companyName, "ko-KR");
        }

        const leftDate = sortKey === "listingDate" ? left.listingDate : left.subscriptionEnd;
        const rightDate = sortKey === "listingDate" ? right.listingDate : right.subscriptionEnd;
        return toIsoDate(leftDate).localeCompare(toIsoDate(rightDate));
      });
  }, [
    bookmarks,
    ipos,
    marketFilter,
    query,
    sortKey,
    statusFilter,
    todayIso,
    underwriterFilter,
  ]);

  const toggleBookmark = (slug: string) => {
    const next = new Set(bookmarks);

    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }

    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new Event(BOOKMARK_EVENT_NAME));
  };

  return (
    <section
      id="ipo-explorer"
      className="mx-auto max-w-7xl border-t border-neutral-200 px-4 py-9 dark:border-neutral-800 sm:px-6 lg:px-8"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            공모주 탐색
          </p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
            검색, 필터, 정렬
          </h2>
        </div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {filteredIpos.length.toLocaleString("ko-KR")}개 표시
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">회사명, 업종, 주관사 검색</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="회사명, 업종, 주관사 검색"
              className="h-11 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>

          <FilterSelect
            label="상태"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "all", label: "전체 상태" },
              { value: "active", label: "청약중" },
              { value: "subscriptionUpcoming", label: "청약 임박" },
              { value: "listingUpcoming", label: "상장 임박" },
              { value: "listed", label: "상장 완료" },
              { value: "bookmarked", label: "관심 공모주" },
            ]}
          />
          <FilterSelect
            label="시장"
            value={marketFilter}
            onChange={setMarketFilter}
            options={[
              { value: "all", label: "전체 시장" },
              ...markets.map((market) => ({ value: market, label: market })),
            ]}
          />
          <FilterSelect
            label="주관사"
            value={underwriterFilter}
            onChange={setUnderwriterFilter}
            options={[
              { value: "all", label: "전체 주관사" },
              ...underwriters.map((underwriter) => ({
                value: underwriter,
                label: underwriter,
              })),
            ]}
          />
          <FilterSelect
            label="정렬"
            value={sortKey}
            onChange={(value) => setSortKey(value as SortKey)}
            options={[
              { value: "featured", label: "추천순" },
              { value: "subscriptionEnd", label: "청약마감순" },
              { value: "listingDate", label: "상장일순" },
              { value: "companyName", label: "회사명순" },
            ]}
          />
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>관심 공모주는 이 브라우저에만 저장됩니다.</span>
        </div>
      </div>

      {filteredIpos.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {filteredIpos.map((ipo) => (
            <ExplorerCard
              key={ipo.id}
              ipo={ipo}
              todayIso={todayIso}
              isBookmarked={bookmarks.has(ipo.slug)}
              onBookmark={() => toggleBookmark(ipo.slug)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            조건에 맞는 공모주가 없습니다.
          </p>
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExplorerCard({
  ipo,
  todayIso,
  isBookmarked,
  onBookmark,
}: {
  ipo: Ipo;
  todayIso: string;
  isBookmarked: boolean;
  onBookmark: () => void;
}) {
  const status = getScheduleStatus(ipo, todayIso);

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none dark:hover:border-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              {ipo.market}
            </span>
            <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {ipo.sector || "업종 미정"}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
            <Link href={`/ipos/${ipo.slug}`} className="hover:text-emerald-700 dark:hover:text-emerald-400">
              {ipo.companyName}
            </Link>
          </h3>
        </div>

        <button
          type="button"
          aria-pressed={isBookmarked}
          aria-label={`${ipo.companyName} 관심 공모주 ${isBookmarked ? "해제" : "저장"}`}
          onClick={onBookmark}
          className={[
            "inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition",
            isBookmarked
              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-white",
          ].join(" ")}
        >
          <Bookmark
            size={16}
            aria-hidden="true"
            fill={isBookmarked ? "currentColor" : "none"}
          />
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <ExplorerMetric
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="청약 기간"
          value={`${formatShortDate(ipo.subscriptionStart)} - ${formatShortDate(ipo.subscriptionEnd)}`}
        />
        <ExplorerMetric
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="상장일"
          value={formatShortDate(ipo.listingDate)}
        />
        <ExplorerMetric
          icon={<Building2 size={15} aria-hidden="true" />}
          label="주관사"
          value={formatUnderwriters(ipo)}
        />
        <ExplorerMetric
          icon={<ArrowUpRight size={15} aria-hidden="true" />}
          label="공모가"
          value={formatOfferPrice(ipo)}
        />
      </dl>

      <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <Link
          href={`/ipos/${ipo.slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          상세
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function ExplorerMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">
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

function getScheduleStatus(ipo: Ipo, todayIso: string) {
  if (ipo.status === "listed" || toIsoDate(ipo.listingDate) <= todayIso) {
    return {
      kind: "listed" as const,
      label: "상장 완료",
      className:
        "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
    };
  }

  if (toIsoDate(ipo.subscriptionStart) <= todayIso && todayIso <= toIsoDate(ipo.subscriptionEnd)) {
    return {
      kind: "active" as const,
      label: "청약중",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  }

  if (toIsoDate(ipo.subscriptionStart) > todayIso) {
    return {
      kind: "subscriptionUpcoming" as const,
      label: "청약 임박",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
    };
  }

  return {
    kind: "listingUpcoming" as const,
    label: "상장 임박",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/60 dark:text-violet-300",
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ko-KR"));
}

function compareFeaturedOrder(left: Ipo, right: Ipo) {
  const statusPriority = {
    active: 0,
    upcoming: 1,
    listed: 2,
  };
  const statusDiff = statusPriority[left.status] - statusPriority[right.status];

  if (statusDiff !== 0) {
    return statusDiff;
  }

  if (left.status === "listed") {
    return toIsoDate(right.listingDate).localeCompare(toIsoDate(left.listingDate));
  }

  return toIsoDate(left.subscriptionStart).localeCompare(toIsoDate(right.subscriptionStart));
}

function subscribeBookmarkStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = (event: Event) => {
    if (
      event instanceof StorageEvent &&
      event.key &&
      event.key !== BOOKMARK_STORAGE_KEY &&
      event.key !== LEGACY_BOOKMARK_STORAGE_KEY
    ) {
      return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(BOOKMARK_EVENT_NAME, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(BOOKMARK_EVENT_NAME, handleChange);
  };
}

function readBookmarkSnapshot() {
  if (typeof window === "undefined") {
    return "[]";
  }

  return (
    window.localStorage.getItem(BOOKMARK_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_BOOKMARK_STORAGE_KEY) ??
    "[]"
  );
}

function getServerBookmarkSnapshot() {
  return "[]";
}

function parseBookmarkSnapshot(rawValue: string) {
  if (!rawValue) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === "string"));
    }
  } catch {
    return new Set<string>();
  }

  return new Set<string>();
}

function formatUnderwriters(ipo: Ipo) {
  const values = [...new Set([ipo.leadManager, ...ipo.underwriters].filter(Boolean))];

  if (values.length === 0) {
    return "미정";
  }

  if (values.length <= 2) {
    return values.join(", ");
  }

  return `${values.slice(0, 2).join(", ")} 외 ${values.length - 2}곳`;
}

function formatOfferPrice(ipo: Ipo) {
  if (ipo.confirmedOfferPrice) {
    return `${ipo.confirmedOfferPrice.toLocaleString("ko-KR")}원`;
  }

  if (ipo.offerPriceRangeLow && ipo.offerPriceRangeHigh) {
    return `${ipo.offerPriceRangeLow.toLocaleString("ko-KR")}~${ipo.offerPriceRangeHigh.toLocaleString("ko-KR")}원`;
  }

  return "미정";
}

function formatShortDate(value: string) {
  const isoDate = toIsoDate(value);
  const date = new Date(`${isoDate}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function toIsoDate(value: string) {
  return value.slice(0, 10);
}
