import { CalendarPlus, Download } from "lucide-react";
import type { Ipo } from "@/lib/ipos";

type ScheduleActionsProps = {
  ipo: Ipo;
};

type ScheduleEvent = {
  key: string;
  label: string;
  date: string;
};

export function ScheduleActions({ ipo }: ScheduleActionsProps) {
  const events = buildScheduleEvents(ipo);
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(ipo, events))}`;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <CalendarPlus size={18} aria-hidden="true" className="text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">일정 저장</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {events.map((event) => (
          <a
            key={event.key}
            href={buildGoogleCalendarUrl(ipo, event)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <CalendarPlus size={15} aria-hidden="true" />
            {event.label}
          </a>
        ))}
        <a
          href={icsHref}
          download={`${ipo.slug}-ipo-schedule.ics`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <Download size={15} aria-hidden="true" />
          ICS
        </a>
      </div>
    </section>
  );
}

function buildScheduleEvents(ipo: Ipo): ScheduleEvent[] {
  return [
    { key: "subscription-start", label: "청약 시작", date: ipo.subscriptionStart },
    { key: "subscription-end", label: "청약 종료", date: ipo.subscriptionEnd },
    { key: "refund", label: "환불", date: ipo.refundDate },
    { key: "listing", label: "상장", date: ipo.listingDate },
  ].filter((event) => Boolean(event.date));
}

function buildGoogleCalendarUrl(ipo: Ipo, event: ScheduleEvent) {
  const searchParams = new URLSearchParams({
    action: "TEMPLATE",
    text: `${ipo.companyName} ${event.label}`,
    dates: `${toCalendarDate(event.date)}/${toCalendarDate(addDays(event.date, 1))}`,
    details: `${ipo.companyName} 공모주 ${event.label} 일정입니다. 대표 주관사: ${
      ipo.leadManager || "미정"
    }`,
  });

  return `https://calendar.google.com/calendar/render?${searchParams.toString()}`;
}

function buildIcs(ipo: Ipo, events: ScheduleEvent[]) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const body = events
    .map((event) =>
      [
        "BEGIN:VEVENT",
        `UID:${ipo.slug}-${event.key}@money-calendar`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${toCalendarDate(event.date)}`,
        `DTEND;VALUE=DATE:${toCalendarDate(addDays(event.date, 1))}`,
        `SUMMARY:${escapeIcsText(`${ipo.companyName} ${event.label}`)}`,
        `DESCRIPTION:${escapeIcsText(
          `${ipo.companyName} 공모주 ${event.label} 일정입니다. 대표 주관사: ${
            ipo.leadManager || "미정"
          }`,
        )}`,
        "END:VEVENT",
      ].join("\r\n"),
    )
    .join("\r\n");

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//money-calendar//KO", body, "END:VCALENDAR"].join("\r\n");
}

function toCalendarDate(value: string) {
  return value.slice(0, 10).replace(/-/g, "");
}

function addDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
