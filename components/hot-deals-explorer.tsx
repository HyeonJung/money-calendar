"use client";

import Image from "next/image";
import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  Clock3,
  Flame,
  PackageCheck,
  RefreshCw,
  Tag,
  Truck,
} from "lucide-react";
import { ExternalDealLink } from "@/components/external-deal-link";
import type { HotDeal } from "@/lib/hot-deals";

type HotDealsExplorerProps = {
  deals: HotDeal[];
};

type CategoryFilter =
  | "전체"
  | "식품"
  | "생활용품"
  | "가전"
  | "뷰티"
  | "패션"
  | "디지털"
  | "스포츠/레저"
  | "도서/취미";

type SortKey = "latest" | "priceAsc" | "priceDesc";

const CATEGORY_FILTERS: CategoryFilter[] = [
  "전체",
  "식품",
  "생활용품",
  "가전",
  "뷰티",
  "패션",
  "디지털",
  "스포츠/레저",
  "도서/취미",
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "latest", label: "최신순" },
  { value: "priceAsc", label: "낮은 가격순" },
  { value: "priceDesc", label: "높은 가격순" },
];

const INITIAL_VISIBLE_COUNT = 16;
const MORE_COUNT = 12;
const BOOKMARK_STORAGE_KEY = "money-calendar-hotdeal-bookmarks";
const BOOKMARK_EVENT_NAME = "money-calendar-hotdeal-bookmarks-change";

export function HotDealsExplorer({ deals }: HotDealsExplorerProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const bookmarkSnapshot = useSyncExternalStore(
    subscribeBookmarkStorage,
    readBookmarkSnapshot,
    getServerBookmarkSnapshot,
  );
  const bookmarks = useMemo(() => parseBookmarkSnapshot(bookmarkSnapshot), [bookmarkSnapshot]);

  const filteredDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        if (categoryFilter === "전체") {
          return true;
        }

        return getDealCategory(deal) === categoryFilter;
      })
      .sort((left, right) => compareDeals(left, right, sortKey));
  }, [categoryFilter, deals, sortKey]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);

  function handleCategoryChange(nextCategory: CategoryFilter) {
    setCategoryFilter(nextCategory);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }

  function toggleBookmark(dealId: string) {
    const nextBookmarks = new Set(bookmarks);

    if (nextBookmarks.has(dealId)) {
      nextBookmarks.delete(dealId);
    } else {
      nextBookmarks.add(dealId);
    }

    writeBookmarkSnapshot([...nextBookmarks]);
  }

  return (
    <main className="min-h-dvh bg-stone-50 pb-10 dark:bg-neutral-950">
      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <HotDealsHero />

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_FILTERS.map((category) => {
              const isActive = categoryFilter === category;

              return (
                <button
                  key={category}
                  type="button"
                  className={[
                    "h-9 shrink-0 rounded-full border px-4 text-sm font-bold transition",
                    isActive
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-200 hover:text-emerald-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-emerald-900 dark:hover:text-emerald-300",
                  ].join(" ")}
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <label className="relative w-full sm:w-40">
            <span className="sr-only">정렬</span>
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as SortKey);
                setVisibleCount(INITIAL_VISIBLE_COUNT);
              }}
              className="h-10 w-full appearance-none rounded-full border border-neutral-200 bg-white px-4 pr-10 text-sm font-bold text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500"
              aria-hidden="true"
            />
          </label>
        </div>

        {visibleDeals.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleDeals.map((deal) => (
              <HotDealProductCard
                key={deal.id}
                deal={deal}
                isBookmarked={bookmarks.has(deal.id)}
                onToggleBookmark={() => toggleBookmark(deal.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white px-5 py-16 text-center dark:border-neutral-700 dark:bg-neutral-950">
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              조건에 맞는 핫딜이 없습니다.
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              다른 카테고리를 선택해보세요.
            </p>
          </div>
        )}

        {visibleDeals.length < filteredDeals.length ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              className="inline-flex h-10 w-full max-w-80 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 text-sm font-bold text-emerald-700 shadow-sm shadow-black/5 hover:border-emerald-200 hover:bg-emerald-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-emerald-300 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30"
              onClick={() => setVisibleCount((count) => count + MORE_COUNT)}
            >
              더 많은 핫딜 보기
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function HotDealsHero() {
  return (
    <section className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="grid gap-6 px-6 py-8 md:grid-cols-[1fr_360px] md:items-center md:px-9 lg:grid-cols-[1fr_380px] lg:px-10">
        <div>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Clock3 size={14} aria-hidden="true" />
            실시간으로 업데이트
          </span>
          <h1 className="mt-4 flex flex-wrap items-center gap-2 text-4xl font-black tracking-normal text-neutral-950 dark:text-white sm:text-5xl">
            지금 가장 <span className="text-rose-500">핫한 딜!</span>
            <Flame size={38} className="text-orange-500" aria-hidden="true" />
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            엄선된 인기 상품을 특별한 가격에 만나보세요.
          </p>

          <div className="mt-8 grid max-w-2xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-3">
            <HeroFeature
              icon={<Tag size={22} aria-hidden="true" />}
              title="오늘의 특가"
              description="매일 업데이트"
              tone="emerald"
            />
            <HeroFeature
              icon={<Truck size={22} aria-hidden="true" />}
              title="무료배송"
              description="일부 상품 제외"
              tone="violet"
            />
            <HeroFeature
              icon={<RefreshCw size={22} aria-hidden="true" />}
              title="실시간 업데이트"
              description="최신 딜 반영"
              tone="orange"
            />
          </div>
        </div>

        <HeroIllustration />
      </div>
    </section>
  );
}

function HeroFeature({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: "emerald" | "violet" | "orange";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300",
  }[tone];

  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-extrabold text-neutral-950 dark:text-white">{title}</p>
        <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="hidden justify-center md:flex">
      <Image
        src="/hotdeal-cart-bag-object-transparent-2x.png"
        alt=""
        width={685}
        height={522}
        priority
        sizes="(min-width: 1024px) 360px, 320px"
        className="h-auto w-full max-w-[320px] select-none object-contain lg:max-w-[360px]"
      />
    </div>
  );
}

function HotDealProductCard({
  deal,
  isBookmarked,
  onToggleBookmark,
}: {
  deal: HotDeal;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const category = getDealCategory(deal);
  const price = splitPriceText(deal.priceText);

  return (
    <article className="relative flex min-h-[292px] flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 transition hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-emerald-900">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 text-xs font-bold text-slate-500 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          <Clock3 size={13} aria-hidden="true" />
          {formatRelativeTime(deal.publishedAt ?? deal.collectedAt)}
        </span>
        <button
          type="button"
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? `${deal.title} 북마크 해제` : `${deal.title} 북마크`}
          className={[
            "inline-flex size-8 items-center justify-center rounded-md border transition",
            isBookmarked
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-neutral-200 bg-white text-neutral-400 hover:border-emerald-200 hover:text-emerald-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-500 dark:hover:border-emerald-900 dark:hover:text-emerald-300",
          ].join(" ")}
          onClick={onToggleBookmark}
        >
          <Bookmark size={17} fill={isBookmarked ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <ExternalDealLink
        href={deal.dealUrl}
        className="relative mx-auto mt-3 block h-24 w-40 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 p-0 dark:border-neutral-800 dark:bg-neutral-900"
        ariaLabel={`${deal.title} 상품 보기`}
      >
        {deal.imageUrl ? (
          <Image
            src={deal.imageUrl}
            alt=""
            fill
            sizes="160px"
            className="object-contain p-1"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-emerald-600 dark:text-emerald-400">
            <PackageCheck size={28} aria-hidden="true" />
          </span>
        )}
      </ExternalDealLink>

      <div className="mt-4 min-h-28">
        <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
          {category}
        </p>
        <h2 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-neutral-950 dark:text-white">
          <ExternalDealLink
            href={deal.dealUrl}
            className="bg-transparent p-0 text-left font-bold hover:text-emerald-700 dark:hover:text-emerald-300"
            ariaLabel={`${deal.title} 상품 보기`}
          >
            {deal.title}
          </ExternalDealLink>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={[
              "text-lg font-black",
              price.amount === "가격 확인"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-500 dark:text-rose-300",
            ].join(" ")}
          >
            {price.amount}
          </span>
          {price.delivery ? (
            <span className="inline-flex h-6 items-center rounded-full bg-rose-50 px-2 text-xs font-extrabold text-rose-500 dark:bg-rose-950/40 dark:text-rose-300">
              {price.delivery}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
          업데이트 {formatRelativeTime(deal.collectedAt)}
        </p>
        <ExternalDealLink
          href={deal.dealUrl}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-0 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
          ariaLabel={`${deal.title} 상품 열기`}
        >
          <ArrowUpRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </ExternalDealLink>
      </div>
    </article>
  );
}

function compareDeals(left: HotDeal, right: HotDeal, sortKey: SortKey) {
  if (sortKey === "priceAsc" || sortKey === "priceDesc") {
    const leftPrice = parsePriceNumber(left.priceText);
    const rightPrice = parsePriceNumber(right.priceText);

    if (leftPrice !== rightPrice) {
      return sortKey === "priceAsc" ? leftPrice - rightPrice : rightPrice - leftPrice;
    }
  }

  return getDealTime(right) - getDealTime(left);
}

function getDealTime(deal: HotDeal) {
  const date = new Date(deal.publishedAt ?? deal.collectedAt);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getDealCategory(deal: HotDeal): CategoryFilter {
  const text = `${deal.category ?? ""} ${deal.title}`.toLowerCase();

  if (text.includes("식품") || /치킨|라면|커피|쌀|고기|과자|음료|우유|만두|김치|소스/.test(text)) {
    return "식품";
  }

  if (/생활|샴푸|세제|화장지|물티슈|마스크|수건|칫솔|치약|주방|프라이팬/.test(text)) {
    return "생활용품";
  }

  if (/가전|청소기|냉장고|세탁기|에어컨|공기청정기|전자레인지|커피머신/.test(text)) {
    return "가전";
  }

  if (/뷰티|화장품|스킨|로션|향수|선크림/.test(text)) {
    return "뷰티";
  }

  if (/패션|신발|자켓|티셔츠|바지|가방|운동화|양말|의류|트러커/.test(text)) {
    return "패션";
  }

  if (/디지털|노트북|모니터|ssd|메모리|키보드|마우스|갤럭시|아이폰|아이패드/.test(text)) {
    return "디지털";
  }

  if (/스포츠|레저|캠핑|등산|자전거|골프|낚시/.test(text)) {
    return "스포츠/레저";
  }

  if (/도서|취미|책|문구|게임|피규어/.test(text)) {
    return "도서/취미";
  }

  return "생활용품";
}

function splitPriceText(priceText: string | null) {
  if (!priceText) {
    return {
      amount: "가격 확인",
      delivery: null,
    };
  }

  const [amount, delivery] = priceText.split("/").map((part) => part.trim()).filter(Boolean);

  return {
    amount: amount || "가격 확인",
    delivery: delivery ?? null,
  };
}

function parsePriceNumber(priceText: string | null) {
  if (!priceText) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = priceText.replace(/,/g, "");
  const tenThousandWon = normalized.match(/(\d+(?:\.\d+)?)\s*만원/);
  if (tenThousandWon) {
    return Number(tenThousandWon[1]) * 10_000;
  }

  const won = normalized.match(/(\d+(?:\.\d+)?)\s*원/);
  if (won) {
    return Number(won[1]);
  }

  if (normalized.includes("무료")) {
    return 0;
  }

  return Number.POSITIVE_INFINITY;
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

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function subscribeBookmarkStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(BOOKMARK_EVENT_NAME, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(BOOKMARK_EVENT_NAME, onStoreChange);
  };
}

function readBookmarkSnapshot() {
  return window.localStorage.getItem(BOOKMARK_STORAGE_KEY) ?? "[]";
}

function getServerBookmarkSnapshot() {
  return "[]";
}

function parseBookmarkSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot);
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeBookmarkSnapshot(bookmarks: string[]) {
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
  window.dispatchEvent(new Event(BOOKMARK_EVENT_NAME));
}
