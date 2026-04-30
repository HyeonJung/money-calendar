"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { Building2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Ipo } from "@/lib/ipos";

type CalendarViewProps = {
  ipos: Ipo[];
};

type CalendarEvent = {
  id: string;
  ipoName: string;
  slug: string;
  kind: "subscriptionStart" | "subscriptionEnd" | "refund" | "listing";
  label: string;
  date: Date;
  managerText: string;
};

type IpoView = Ipo & {
  id?: string | number;
  slug?: string;
  companyName?: string;
  company?: string;
  name?: string;
  subscriptionStart?: Date | string | null;
  subscriptionEnd?: Date | string | null;
  subscriptionStartDate?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  refundDate?: Date | string | null;
  listingDate?: Date | string | null;
  underwriters?: string[] | string | null;
  leadManager?: string | null;
  leadManagers?: string[] | string | null;
};

const EVENT_KIND_ORDER: CalendarEvent["kind"][] = [
  "subscriptionStart",
  "subscriptionEnd",
  "refund",
  "listing",
];

const EVENT_STYLES: Record<
  CalendarEvent["kind"],
  {
    label: string;
    className: string;
  }
> = {
  subscriptionStart: {
    label: "청약 시작",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950",
  },
  subscriptionEnd: {
    label: "청약 종료",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:border-amber-800 dark:hover:bg-amber-950",
  },
  refund: {
    label: "환불",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:border-sky-800 dark:hover:bg-sky-950",
  },
  listing: {
    label: "상장",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900/70 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:border-violet-800 dark:hover:bg-violet-950",
  },
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarView({ ipos }: CalendarViewProps) {
  const today = getTodayInSeoul();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => today);
  const [visibleKinds, setVisibleKinds] = useState<Set<CalendarEvent["kind"]>>(
    () => new Set(EVENT_KIND_ORDER),
  );
  const events = buildCalendarEvents(ipos);
  const filteredEvents = events.filter((event) => visibleKinds.has(event.kind));
  const monthEvents = filteredEvents.filter((event) => isSameMonth(event.date, currentMonth));
  const selectedEvents = filteredEvents.filter((event) => isSameDay(event.date, selectedDate));
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
  });

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none">
      <div className="flex flex-col gap-4 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">월간 일정 보기</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarButton
              label="이전 달"
              icon={<ChevronLeft size={16} aria-hidden="true" />}
              onClick={() => setCurrentMonth((value) => subMonths(value, 1))}
            />
            <CalendarButton
              label="오늘"
              icon={<CalendarDays size={16} aria-hidden="true" />}
              onClick={() => {
                setCurrentMonth(startOfMonth(today));
                setSelectedDate(today);
              }}
            />
            <CalendarButton
              label="다음 달"
              icon={<ChevronRight size={16} aria-hidden="true" />}
              onClick={() => setCurrentMonth((value) => addMonths(value, 1))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {EVENT_KIND_ORDER.map((kind) => {
            const meta = EVENT_STYLES[kind];
            const isVisible = visibleKinds.has(kind);

            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isVisible}
                onClick={() => {
                  setVisibleKinds((current) => {
                    const next = new Set(current);

                    if (next.has(kind)) {
                      next.delete(kind);
                    } else {
                      next.add(kind);
                    }

                    return next;
                  });
                }}
                className={[
                  "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold transition",
                  meta.className,
                  isVisible
                    ? "ring-1 ring-inset ring-current/20"
                    : "opacity-45 grayscale hover:opacity-80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <MobileEventList
        events={monthEvents}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-3 py-2 text-xs font-semibold tracking-tight text-neutral-500 dark:text-neutral-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayEvents = filteredEvents.filter((event) => isSameDay(event.date, day));
              const visibleEvents = dayEvents.slice(0, 3);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={day.toISOString()}
                  className={[
                    "flex min-h-32 flex-col gap-2 border-b border-r border-neutral-200 p-2.5 align-top dark:border-neutral-800 sm:min-h-36 sm:p-3",
                    !isCurrentMonth && "bg-neutral-50/70 dark:bg-neutral-900/40",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={[
                        "inline-flex size-7 items-center justify-center rounded-md text-sm font-semibold",
                        isSameDay(day, selectedDate)
                          ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                          : isToday
                          ? "bg-emerald-600 text-white"
                          : isCurrentMonth
                            ? "text-neutral-900 dark:text-neutral-100"
                            : "text-neutral-400 dark:text-neutral-600",
                      ].join(" ")}
                    >
                      {format(day, "d")}
                    </button>
                    {dayEvents.length > 0 ? (
                      <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                        {dayEvents.length}건
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5">
                    {visibleEvents.map((event) => {
                      const meta = EVENT_STYLES[event.kind];

                      return (
                        <CalendarEventLink
                          key={event.id}
                          event={event}
                          className={`rounded-md border px-2 py-1.5 text-[11px] leading-4 transition-colors ${meta.className}`}
                        />
                      );
                    })}

                    {dayEvents.length > visibleEvents.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(day)}
                        className="px-1 text-left text-[11px] font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                      >
                        +{dayEvents.length - visibleEvents.length}개 일정 더보기
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SelectedDatePanel date={selectedDate} events={selectedEvents} />
    </section>
  );
}

function MobileEventList({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800 md:hidden">
      <div className="px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">날짜별 일정</p>
      </div>
      {groupedEvents.length > 0 ? (
        groupedEvents.map(({ date, events: dateEvents }) => (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onSelectDate(date)}
            className={[
              "block w-full px-4 py-3 text-left transition sm:px-5",
              isSameDay(date, selectedDate)
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "hover:bg-neutral-50 dark:hover:bg-neutral-900",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                {format(date, "M월 d일 EEEE", { locale: ko })}
              </p>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {dateEvents.length}건
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dateEvents.slice(0, 4).map((event) => (
                <span
                  key={event.id}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${EVENT_STYLES[event.kind].className}`}
                >
                  {event.label} · {event.ipoName}
                </span>
              ))}
            </div>
          </button>
        ))
      ) : (
        <p className="px-4 py-8 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 sm:px-5">
          표시할 일정이 없습니다.
        </p>
      )}
    </div>
  );
}

function SelectedDatePanel({
  date,
  events,
}: {
  date: Date;
  events: CalendarEvent[];
}) {
  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/40 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            선택한 날짜 일정
          </p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
            {format(date, "yyyy년 M월 d일 EEEE", { locale: ko })}
          </h3>
        </div>
        <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          {events.length}건
        </span>
      </div>

      {events.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <CalendarEventLink
              key={event.id}
              event={event}
              className={`rounded-lg border px-3 py-2.5 text-sm leading-5 transition-colors ${EVENT_STYLES[event.kind].className}`}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-white p-4 text-sm font-medium text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
          표시할 일정이 없습니다.
        </p>
      )}
    </div>
  );
}

function CalendarEventLink({
  event,
  className,
}: {
  event: CalendarEvent;
  className: string;
}) {
  return (
    <Link href={`/ipos/${event.slug}`} className={className}>
      <div className="font-semibold">{event.label}</div>
      <div className="mt-0.5 truncate opacity-90">{event.ipoName}</div>
      {event.managerText ? (
        <div className="mt-1 flex min-w-0 items-center gap-1 text-[0.78em] leading-4 opacity-80">
          <Building2 size={12} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{event.managerText}</span>
        </div>
      ) : null}
    </Link>
  );
}

function CalendarButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-white"
    >
      {icon}
      {label}
    </button>
  );
}

function buildCalendarEvents(ipos: Ipo[]) {
  return ipos
    .flatMap((ipo) => {
      const view = ipo as IpoView;
      const slug = view.slug;
      const ipoName = view.companyName ?? view.company ?? view.name ?? "종목명 미정";
      const managerText = formatManagerText(
        view.underwriters ?? view.leadManagers ?? view.leadManager,
      );

      if (!slug) {
        return [];
      }

      const baseId = String(view.id ?? slug);

      return [
        buildEvent(
          baseId,
          slug,
          ipoName,
          managerText,
          "subscriptionStart",
          view.subscriptionStart ?? view.subscriptionStartDate,
        ),
        buildEvent(
          baseId,
          slug,
          ipoName,
          managerText,
          "subscriptionEnd",
          view.subscriptionEnd ?? view.subscriptionEndDate,
        ),
        buildEvent(baseId, slug, ipoName, managerText, "refund", view.refundDate),
        buildEvent(baseId, slug, ipoName, managerText, "listing", view.listingDate),
      ].filter(Boolean) as CalendarEvent[];
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function groupEventsByDate(events: CalendarEvent[]) {
  const grouped = new Map<string, { date: Date; events: CalendarEvent[] }>();

  for (const event of events) {
    const key = format(event.date, "yyyy-MM-dd");
    const current = grouped.get(key);

    if (current) {
      current.events.push(event);
    } else {
      grouped.set(key, {
        date: event.date,
        events: [event],
      });
    }
  }

  return [...grouped.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function buildEvent(
  baseId: string,
  slug: string,
  ipoName: string,
  managerText: string,
  kind: CalendarEvent["kind"],
  rawDate: Date | string | null | undefined,
) {
  const date = parseDate(rawDate);

  if (!date) {
    return null;
  }

  return {
    id: `${baseId}-${kind}-${date.toISOString()}`,
    ipoName,
    slug,
    kind,
    label: EVENT_STYLES[kind].label,
    date,
    managerText,
  } satisfies CalendarEvent;
}

function formatManagerText(value: string[] | string | null | undefined) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return "";
  }

  const managers = Array.isArray(value)
    ? value.filter(Boolean)
    : value.split(",").map((item) => item.trim()).filter(Boolean);

  if (managers.length <= 2) {
    return managers.join(", ");
  }

  return `${managers.slice(0, 2).join(", ")} 외 ${managers.length - 2}곳`;
}

function getTodayInSeoul() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] =
    formatter.formatToParts(new Date());

  return new Date(Number(year), Number(month) - 1, Number(day));
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
