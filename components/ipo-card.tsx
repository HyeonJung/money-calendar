import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, CalendarDays, Landmark, LineChart } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import type { Ipo } from "@/lib/ipos";
import { StatusBadge } from "@/components/status-badge";

type IpoCardProps = {
  ipo: Ipo;
};

type IpoView = Ipo & {
  id?: string | number;
  slug?: string;
  status?: string;
  companyName?: string;
  company?: string;
  name?: string;
  market?: string;
  industry?: string;
  sector?: string;
  subscriptionStart?: Date | string | null;
  subscriptionEnd?: Date | string | null;
  subscriptionStartDate?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  refundDate?: Date | string | null;
  listingDate?: Date | string | null;
  desiredPriceRange?: string | null;
  desiredPriceMin?: number | string | null;
  desiredPriceMax?: number | string | null;
  offerPriceRangeLow?: number | string | null;
  offerPriceRangeHigh?: number | string | null;
  confirmedPrice?: number | string | null;
  confirmedOfferPrice?: number | string | null;
  offerPrice?: number | string | null;
  underwriters?: string[] | string | null;
  leadManager?: string | null;
  leadManagers?: string[] | string | null;
  competitionRate?: string | number | null;
  institutionCompetitionRate?: string | number | null;
  demandForecastCompetition?: string | number | null;
  lockupRate?: string | number | null;
  mandatoryHoldingRate?: string | number | null;
  highlights?: string[] | null;
  keyPoints?: string[] | null;
};

export function IpoCard({ ipo }: IpoCardProps) {
  const view = ipo as IpoView;
  const companyName = view.companyName ?? view.company ?? view.name ?? "종목명 미정";
  const market = view.market ?? "시장 미정";
  const industry = view.industry ?? view.sector ?? "업종 정보 없음";
  const detailHref = view.slug ? `/ipos/${view.slug}` : "/calendar";
  const subscriptionPeriod = formatDateRange(
    view.subscriptionStart ?? view.subscriptionStartDate,
    view.subscriptionEnd ?? view.subscriptionEndDate,
  );
  const refundDate = formatDate(view.refundDate);
  const listingDate = formatDate(view.listingDate);
  const desiredPrice = formatDesiredPrice(view);
  const confirmedPrice = formatPrice(
    view.confirmedOfferPrice ?? view.confirmedPrice ?? view.offerPrice,
  );
  const underwriters = formatList(
    view.underwriters ?? view.leadManagers ?? view.leadManager,
  );
  const institutionCompetitionRate = formatMetric(
    view.competitionRate ??
      view.institutionCompetitionRate ??
      view.demandForecastCompetition,
    ":1",
  );
  const lockupRate = formatMetric(
    view.lockupRate ?? view.mandatoryHoldingRate,
    "%",
  );
  const highlights = (view.highlights ?? view.keyPoints ?? []).filter(Boolean);

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm shadow-black/5 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none dark:hover:border-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{market}</p>
            {view.status ? (
              <StatusBadge
                status={view.status}
                subscriptionStart={view.subscriptionStart ?? view.subscriptionStartDate}
                subscriptionEnd={view.subscriptionEnd ?? view.subscriptionEndDate}
                listingDate={view.listingDate}
              />
            ) : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
            <Link href={detailHref} className="hover:text-emerald-700 dark:hover:text-emerald-400">
              {companyName}
            </Link>
          </h3>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{industry}</p>
        </div>
        <Link
          href={detailHref}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
        >
          상세
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-neutral-100 pt-4 text-sm dark:border-neutral-800 sm:grid-cols-2">
        <InfoItem
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="청약 기간"
          value={subscriptionPeriod}
        />
        <InfoItem
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="환불일"
          value={refundDate}
        />
        <InfoItem
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="상장일"
          value={listingDate}
        />
        <InfoItem
          icon={<LineChart size={15} aria-hidden="true" />}
          label="희망 공모가"
          value={desiredPrice}
        />
        <InfoItem
          icon={<LineChart size={15} aria-hidden="true" />}
          label="확정 공모가"
          value={confirmedPrice}
        />
        <InfoItem
          icon={<Building2 size={15} aria-hidden="true" />}
          label="주관사"
          value={underwriters}
        />
        <InfoItem
          icon={<Landmark size={15} aria-hidden="true" />}
          label="기관경쟁률"
          value={institutionCompetitionRate}
        />
        <InfoItem
          icon={<Landmark size={15} aria-hidden="true" />}
          label="의무보유확약"
          value={lockupRate}
        />
      </dl>

      <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">주요 포인트</p>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            일정 상세
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {highlights.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {highlights.slice(0, 4).map((item) => (
              <li
                key={item}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs leading-5 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            공모 구조와 일정 포인트는 상세 페이지에서 확인할 수 있습니다.
          </p>
        )}
      </div>
    </article>
  );
}

function InfoItem({
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

function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate && !endDate) {
    return "일정 미정";
  }

  if (startDate && endDate) {
    return `${format(startDate, "M.d(EEE)", { locale: ko })} - ${format(
      endDate,
      "M.d(EEE)",
      { locale: ko },
    )}`;
  }

  return formatDate(startDate ?? endDate);
}

function formatDate(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : parseDate(value);

  if (!date) {
    return "미정";
  }

  return format(date, "yyyy.MM.dd(EEE)", { locale: ko });
}

function formatDesiredPrice(view: IpoView) {
  if (view.desiredPriceRange) {
    return view.desiredPriceRange;
  }

  const min = formatPrice(view.desiredPriceMin);
  const max = formatPrice(view.desiredPriceMax);

  if (min !== "-" && max !== "-") {
    return `${min} - ${max}`;
  }

  const rangeLow = formatPrice(view.offerPriceRangeLow);
  const rangeHigh = formatPrice(view.offerPriceRangeHigh);

  if (rangeLow !== "-" && rangeHigh !== "-") {
    return `${rangeLow} - ${rangeHigh}`;
  }

  return "-";
}

function formatPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return `${value.toLocaleString("ko-KR")}원`;
  }

  if (/^\d+$/.test(value)) {
    return `${Number(value).toLocaleString("ko-KR")}원`;
  }

  return value;
}

function formatMetric(
  value: string | number | null | undefined,
  unit: string,
) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return `${value.toLocaleString("ko-KR")}${unit}`;
  }

  if (/^\d+(\.\d+)?$/.test(value)) {
    return `${value}${unit}`;
  }

  return value;
}

function formatList(value: string[] | string | null | undefined) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return "-";
  }

  return Array.isArray(value) ? value.join(", ") : value;
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const parsed = parseISO(value);

  if (isValid(parsed)) {
    return parsed;
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}
