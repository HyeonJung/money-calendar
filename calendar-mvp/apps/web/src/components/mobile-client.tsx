"use client";

import { api, type EventInput } from "@/lib/api";
import { addDays, dateKey, formatTime, isAllDayDateRangeValid, isoAt, monthGrid, monthRange, sameDate, startOfWeek, toInclusiveAllDayEndDate, toInputDate, toKoreanDate, WEEKDAYS } from "@/lib/date";
import type { AttendeeResponseStatus, Calendar, CalendarEvent, EventAttendee, User } from "@/types/calendar";
import { AvatarGroup, Badge, Button, Card, ColorDot, Input, RoleBadge, Select, Textarea } from "@/components/ui";
import { CalendarCheck2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileText, Filter, Info, MapPin, Menu, MoreHorizontal, Pencil, Plus, Settings, Trash2, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

export function MobileCalendarHome({ mode = "month" }: { mode?: "month" | "day" | "filter" }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidayEvents, setHolidayEvents] = useState<CalendarEvent[]>([]);
  const [cursor, setCursor] = useState(new Date(2026, 4, 24));
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 4, 24));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setUser(await api.me());
      const cals = await api.calendars(true);
      setCalendars(cals);
      const range = monthRange(cursor);
      setEvents(await api.events({ ...range, calendarIds: cals.filter((c) => c.subscriptionStatus === "SUBSCRIBED").map((c) => c.id) }));
      const holidayCalendarIds = cals.filter((calendar) => calendar.type === "SYSTEM_HOLIDAY").map((calendar) => calendar.id);
      setHolidayEvents(holidayCalendarIds.length ? await api.events({ ...range, calendarIds: holidayCalendarIds, view: "MONTH" }) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      router.push("/login");
    }
  }, [cursor, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (mode === "filter") return <MobileFilter calendars={calendars} reload={load} />;

  const selectedEvents = eventsForDate(events, selectedDate);
  const allDayEvents = selectedEvents.filter((event) => event.isAllDay);
  const timedEvents = selectedEvents.filter((event) => !event.isAllDay);
  const weekStart = startOfWeek(selectedDate);
  return (
    <main className="relative mx-auto min-h-screen max-w-[430px] overflow-x-hidden bg-white pb-28 text-slate-950">
      <MobileStatusBar />
      <header className={`sticky top-0 z-10 bg-white/95 px-5 backdrop-blur ${mode === "month" ? "pb-3" : "border-b border-slate-100 pb-4"}`}>
        {mode === "month" ? (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-[28px] font-black tracking-normal">캘린더</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    setCursor(today);
                    setSelectedDate(today);
                  }}
                  className="h-11 rounded-xl border border-[#0B3B91] px-4 text-sm font-extrabold text-[#0B3B91]"
                >
                  오늘
                </button>
                <button onClick={() => router.push("/mobile/calendar/filter")} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="캘린더 보기 설정">
                  <Filter size={22} />
                </button>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="사용자 프로필">
                  <UserCircle size={25} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[44px_1fr_44px] items-center">
              <button onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-600" aria-label="이전 달">
                <ChevronLeft size={26} />
              </button>
              <h2 className="text-center text-2xl font-black">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</h2>
              <button onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-600" aria-label="다음 달">
                <ChevronRight size={26} />
              </button>
            </div>
            <MobileSegment />
          </>
        ) : (
          <>
            <div className="grid grid-cols-[44px_1fr_auto_44px] items-center gap-3">
              <button className="grid h-11 w-11 place-items-center" onClick={() => router.push("/mobile/calendar")} aria-label="캘린더 홈"><Menu size={28} /></button>
              <h1 className="text-center text-2xl font-black">{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</h1>
              <button onClick={() => { const today = new Date(); setCursor(today); setSelectedDate(today); }} className="h-11 rounded-xl border border-[#0B3B91] px-4 text-sm font-extrabold text-[#0B3B91]">오늘</button>
              <button className="grid h-11 w-11 place-items-center" disabled title="MVP 제외 기능입니다." aria-label="더보기"><MoreHorizontal size={28} /></button>
            </div>
          </>
        )}
      </header>
      {error ? <div className="m-4 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
      {mode === "month" ? (
        <section className="pt-1">
          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((day, index) => <div key={day} className={`border-b border-slate-100 py-2 text-sm font-semibold ${index === 0 ? "text-rose-500" : index === 6 ? "text-blue-500" : "text-slate-400"}`}>{day}</div>)}
            {monthGrid(cursor).map((day) => {
              const dayEvents = eventsForDate(events, day);
              const holidayEvent = eventsForDate(holidayEvents, day)[0];
              const holiday = Boolean(holidayEvent);
              const outsideMonth = day.getMonth() !== cursor.getMonth();
              const visibleEvents = dayEvents.slice(0, 3);
              return (
                <button
                  key={dateKey(day)}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[105px] overflow-hidden border-b border-slate-100 px-0.5 py-2 text-center ${sameDate(day, selectedDate) ? "bg-slate-100" : "bg-white"}`}
                >
                  <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-base font-semibold ${sameDate(day, selectedDate) ? "bg-rose-500 text-white" : outsideMonth ? "text-slate-300" : day.getDay() === 0 || holiday ? "text-red-500" : day.getDay() === 6 ? "text-blue-600" : "text-slate-900"}`}>{day.getDate()}</span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-400">{mockSubDate(day)}</span>
                  <div className="mt-2 space-y-1">
                    {visibleEvents.map((event) => <MobileMonthEventLabel key={event.id} event={event} />)}
                    {dayEvents.length > 3 ? <span className="block rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-600">+{dayEvents.length - 3}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="border-b border-slate-100 px-5 py-5">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((day) => (
              <button key={dateKey(day)} onClick={() => setSelectedDate(day)} className={`min-w-[58px] rounded-2xl px-3 py-2 text-center ${sameDate(day, selectedDate) ? "bg-[#0B3B91] text-white shadow-lg shadow-blue-900/20" : "bg-white"}`}>
                <span className={`block text-sm font-bold ${!sameDate(day, selectedDate) && (day.getDay() === 0 || isHolidayDate(holidayEvents, day)) ? "text-rose-600" : !sameDate(day, selectedDate) && day.getDay() === 6 ? "text-blue-600" : "text-slate-500"}`}>{WEEKDAYS[day.getDay()]}</span>
                <strong className="mt-1 block text-xl">{day.getDate()}</strong>
                <div className="mt-2 flex justify-center gap-1">
                  {eventsForDate(events, day).slice(0, 4).map((event) => <span key={event.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: event.calendarColor }} />)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="px-5 pt-5">
        {mode === "month" ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-xl font-black ${isHolidayDate(holidayEvents, selectedDate) || selectedDate.getDay() === 0 ? "text-rose-600" : "text-slate-950"}`}>
                {toKoreanDate(selectedDate)} 일정
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{selectedEvents.length}개 일정</span>
            </div>
            <div className="space-y-3">
              {selectedEvents.map((event) => <MobileEventCard key={event.id} event={event} />)}
              {selectedEvents.length === 0 ? <MobileEmptyCard /> : null}
            </div>
          </>
        ) : (
          <div className="space-y-7">
            <MobileEventSection title="종일 일정" events={allDayEvents} emptyTitle="종일 일정이 없습니다." />
            <MobileEventSection title="시간 일정" events={timedEvents} emptyTitle="이 시간대에는 일정이 없습니다." />
          </div>
        )}
      </section>
      <div className="pointer-events-none fixed inset-x-0 bottom-24 mx-auto flex w-full max-w-[430px] justify-end px-6">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <button onClick={() => router.push("/mobile/events/new")} className="grid h-16 w-16 place-items-center rounded-full bg-[#0B3B91] text-white shadow-xl shadow-blue-900/30" aria-label={`${user?.displayName || "사용자"} 새 일정 만들기`}><Plus size={36} strokeWidth={3} /></button>
          {mode === "day" ? <span className="text-sm font-extrabold text-[#0B3B91]">일정 추가</span> : null}
        </div>
      </div>
      {mode === "month" ? <MobileTabBar /> : null}
    </main>
  );
}

function MobileEventCard({ event }: { event: CalendarEvent }) {
  const duration = event.isAllDay ? (event.source === "SYSTEM_HOLIDAY" ? "공휴일" : "종일") : eventDurationLabel(event);
  return (
    <a href={`/mobile/events/${event.id}`} className="relative grid min-h-[76px] grid-cols-[72px_1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: event.calendarColor }} />
      <div className="text-center">
        <p className="text-base font-black">{event.isAllDay ? "종일" : formatTime(event.startsAt)}</p>
        {!event.isAllDay ? <p className="mt-1 text-xs font-semibold text-slate-500">~ {formatTime(event.endsAt)}</p> : null}
      </div>
      <div className="min-w-0 border-l border-slate-100 pl-4">
        <h4 className="truncate text-lg font-black">{event.title}</h4>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <ColorDot color={event.calendarColor} className="h-2 w-2" />
          <span className="truncate">{event.calendarName}</span>
          {event.location ? <span className="truncate">· {event.location}</span> : null}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Badge color={event.source === "SYSTEM_HOLIDAY" ? "rose" : ["OWNER", "ADMIN", "EDITOR"].includes(event.role) ? "blue" : "slate"}>
          {event.source === "SYSTEM_HOLIDAY" ? "공휴일" : ["OWNER", "ADMIN", "EDITOR"].includes(event.role) ? "편집 가능" : "보기"}
        </Badge>
        <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-bold text-slate-500">{duration}</span>
        <AvatarGroup attendees={event.attendeePreview} count={event.attendeeCount} size="sm" max={2} />
      </div>
    </a>
  );
}

function MobileMonthEventLabel({ event }: { event: CalendarEvent }) {
  return (
    <span
      className="block truncate rounded px-1 py-0.5 text-[11px] font-black leading-4 text-white"
      style={{ backgroundColor: event.source === "SYSTEM_HOLIDAY" ? "#EF4444" : event.calendarColor }}
      title={event.title}
    >
      {event.title}
    </span>
  );
}

function MobileSegment() {
  return (
    <div className="ml-auto mt-4 grid w-[168px] grid-cols-3 rounded-2xl bg-slate-100 p-1 text-sm font-black text-slate-500">
      <a className="rounded-xl bg-[#0B3B91] py-2 text-center text-white" href="/mobile/calendar">월</a>
      <a className="rounded-xl py-2 text-center" href="/mobile/calendar/day">주</a>
      <a className="rounded-xl py-2 text-center" href="/mobile/calendar/day">일</a>
    </div>
  );
}

function MobileEventSection({ title, events, emptyTitle }: { title: string; events: CalendarEvent[]; emptyTitle: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        <ChevronDown size={20} className="text-slate-500" />
      </div>
      {events.map((event) => <MobileEventCard key={event.id} event={event} />)}
      {events.length === 0 ? <MobileEmptyCard title={emptyTitle} /> : null}
    </section>
  );
}

function MobileEmptyCard({ title = "이 날짜에는 일정이 없습니다." }: { title?: string }) {
  return (
    <Card className="grid min-h-28 place-items-center p-6 text-center text-slate-500">
      <div>
        <CalendarCheck2 className="mx-auto mb-3 text-slate-300" size={38} />
        <p className="text-sm font-semibold">{title}</p>
      </div>
    </Card>
  );
}

function MobileStatusBar() {
  return (
    <div className="flex h-12 items-center justify-between bg-white px-9 pt-2 text-sm font-black">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 items-end gap-0.5">
          <span className="block h-1.5 w-1 rounded-sm bg-slate-950" />
          <span className="block h-2.5 w-1 rounded-sm bg-slate-950" />
          <span className="block h-3.5 w-1 rounded-sm bg-slate-950" />
        </span>
        <span className="h-3 w-4 rounded-sm border-2 border-slate-950" />
      </div>
    </div>
  );
}

function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 left-1/2 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-slate-100 bg-white pb-7 pt-4 text-center text-[11px] font-bold text-slate-500">
      <a className="text-[#0B3B91]" href="/mobile/calendar"><CalendarDays className="mx-auto mb-1" size={26} />캘린더</a>
      <a href="/mobile/calendar/day"><CalendarCheck2 className="mx-auto mb-1" size={26} />일정</a>
      <a href="/mobile/calendar/settings"><Settings className="mx-auto mb-1" size={26} />캘린더 설정</a>
      <a href="/admin/holiday-sync-runs"><MoreHorizontal className="mx-auto mb-1" size={26} />더보기</a>
    </nav>
  );
}

function MobileFilter({ calendars, reload }: { calendars: Calendar[]; reload: () => Promise<void> }) {
  async function setAll(status: "SUBSCRIBED" | "HIDDEN") {
    await Promise.all(calendars.map((calendar) => api.updateSubscription(calendar.id, status)));
    await reload();
  }
  const myCalendars = calendars.filter((calendar) => calendar.type === "USER" && calendar.role === "OWNER");
  const sharedCalendars = calendars.filter((calendar) => calendar.type === "USER" && calendar.role !== "OWNER");
  const systemCalendars = calendars.filter((calendar) => calendar.type === "SYSTEM_HOLIDAY");
  return (
    <main className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-slate-950/60 text-slate-950">
      <div className="absolute inset-0 bg-white opacity-45">
        <MobileStatusBar />
        <div className="flex items-center justify-between px-5 py-4">
          <Menu size={28} />
          <h1 className="text-2xl font-black">2026년 5월</h1>
          <Filter size={28} />
        </div>
        <div className="grid grid-cols-7 border-y border-slate-200 text-center">
          {WEEKDAYS.map((day, index) => <div key={day} className={`py-3 text-sm font-bold ${index === 0 ? "text-rose-500" : index === 6 ? "text-blue-500" : ""}`}>{day}</div>)}
          {monthGrid(new Date(2026, 4, 1)).map((day) => <div key={dateKey(day)} className="min-h-[58px] border-r border-t border-slate-100 pt-3 text-lg font-bold">{day.getDate()}</div>)}
        </div>
      </div>
      <section className="absolute inset-x-0 bottom-0 max-h-[76vh] overflow-auto rounded-t-[28px] bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-6 h-1.5 w-16 rounded-full bg-slate-200" />
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">캘린더 표시 설정</h1>
          <div className="flex items-center gap-3 text-sm font-black text-[#0B3B91]">
            <button onClick={() => setAll("SUBSCRIBED")}>전체 선택</button>
            <span className="h-4 w-px bg-slate-200" />
            <button onClick={() => setAll("HIDDEN")}>전체 해제</button>
          </div>
        </div>
        <div className="space-y-6">
          <FilterGroup title="내 캘린더" calendars={myCalendars} reload={reload} />
          <FilterGroup title="공유받은 캘린더" calendars={sharedCalendars} reload={reload} />
          <FilterGroup title="시스템 캘린더" calendars={systemCalendars} reload={reload} />
        </div>
        <Button className="mt-6 w-full text-lg" onClick={() => history.back()}>적용</Button>
      </section>
    </main>
  );
}

function FilterGroup({ title, calendars, reload }: { title: string; calendars: Calendar[]; reload: () => Promise<void> }) {
  if (calendars.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-black text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {calendars.map((calendar) => <FilterRow key={calendar.id} calendar={calendar} reload={reload} />)}
      </div>
    </section>
  );
}

function FilterRow({ calendar, reload }: { calendar: Calendar; reload: () => Promise<void> }) {
  async function toggle() {
    await api.updateSubscription(calendar.id, calendar.subscriptionStatus === "SUBSCRIBED" ? "HIDDEN" : "SUBSCRIBED");
    await reload();
  }
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 bg-white p-4 last:border-b-0">
      <ColorDot color={calendar.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-black">{calendar.name}</p>
        <div className="mt-1"><RoleBadge role={calendar.role} system={calendar.type === "SYSTEM_HOLIDAY"} /></div>
        {calendar.type === "SYSTEM_HOLIDAY" ? <p className="mt-2 text-xs font-semibold text-slate-500">공휴일 일정은 시스템에서 자동 관리됩니다.</p> : null}
      </div>
      <button onClick={toggle} className={`h-8 w-14 rounded-full p-1 transition ${calendar.subscriptionStatus === "SUBSCRIBED" ? "bg-[#0B3B91]" : "bg-slate-300"}`} aria-label={`${calendar.name} 표시 전환`}><span className={`block h-6 w-6 rounded-full bg-white transition ${calendar.subscriptionStatus === "SUBSCRIBED" ? "translate-x-6" : ""}`} /></button>
    </div>
  );
}

export function MobileEventDetail({ eventId, edit = false }: { eventId?: string; edit?: boolean }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState(toInputDate(new Date(2026, 4, 24)));
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState(toInputDate(new Date(2026, 4, 24)));
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [originalAttendees, setOriginalAttendees] = useState<EventAttendee[]>([]);
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setCurrentUser(await api.me());
      const cals = await api.calendars(true);
      setCalendars(cals);
      setCalendarId(cals.find((calendar) => !calendar.isReadonly && ["OWNER", "ADMIN", "EDITOR"].includes(calendar.role))?.id || "");
      if (eventId) {
        const item = await api.event(eventId);
        setEvent(item);
        setTitle(item.title);
        setCalendarId(item.calendarId);
        setIsAllDay(item.isAllDay);
        setStartDate(toInputDate(new Date(item.startsAt)));
        setStartTime(formatTime(item.startsAt));
        setEndDate(item.isAllDay ? toInclusiveAllDayEndDate(item.endsAt) : toInputDate(new Date(item.endsAt)));
        setEndTime(formatTime(item.endsAt));
        setLocation(item.location || "");
        setDescription(item.description || "");
        setAttendees(item.attendees || []);
        setOriginalAttendees(item.attendees || []);
      }
    }
    load().catch(() => router.push("/login"));
  }, [eventId, router]);

  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId);
  const readonly = event?.source === "SYSTEM_HOLIDAY" || selectedCalendar?.isReadonly || selectedCalendar?.role === "VIEWER";
  const formMode = !eventId || edit;
  const myAttendee = event?.attendees?.find((attendee) => attendee.userId === currentUser?.id);

  function addLocalAttendee() {
    const email = attendeeEmail.trim().toLowerCase();
    setError("");
    if (!isValidEmail(email)) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    if (attendees.some((attendee) => attendee.email.toLowerCase() === email)) {
      setError("이미 추가된 참석자입니다.");
      return;
    }
    setAttendees((items) => [
      ...items,
      {
        id: `pending-${email}`,
        eventId: eventId || "new",
        userId: "",
        email,
        displayName: email,
        responseStatus: "NEEDS_ACTION",
        pending: true,
      },
    ]);
    setAttendeeEmail("");
  }

  async function updateRsvp(responseStatus: AttendeeResponseStatus) {
    if (!eventId) return;
    setSaving(true);
    setMessage("");
    try {
      await api.updateMyRsvp(eventId, responseStatus);
      const next = await api.event(eventId);
      setEvent(next);
      setAttendees(next.attendees || []);
      setMessage("참석 응답을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "응답을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setError("");
    const input: EventInput = { calendarId, title, description, location, startsAt: isoAt(startDate, isAllDay ? "00:00" : startTime), endsAt: isoAt(endDate, isAllDay ? "00:00" : endTime), timezone: "Asia/Seoul", isAllDay };
    if (isAllDay && !isAllDayDateRangeValid(startDate, endDate)) {
      setError("종료일은 시작일과 같거나 이후여야 합니다.");
      return;
    }
    if (!isAllDay && new Date(input.endsAt) <= new Date(input.startsAt)) {
      setError("종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const saved = eventId ? await api.updateEvent(eventId, input) : await api.createEvent(input);
      if (!readonly) await syncMobileAttendeeChanges(saved.id, originalAttendees, attendees);
      router.push("/mobile/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!eventId || !confirm("삭제할까요?")) return;
    setSaving(true);
    try {
      await api.deleteEvent(eventId);
      router.push("/mobile/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!formMode && event) {
    return (
      <main className="mx-auto min-h-screen max-w-[430px] bg-[#f6f8fb] pb-8 text-slate-950">
        <MobileStatusBar />
        <header className="grid grid-cols-[44px_1fr_44px] items-center bg-white px-5 pb-5">
          <button className="grid h-11 w-11 place-items-center" onClick={() => router.back()} aria-label="뒤로"><ChevronLeft size={30} /></button>
          <h1 className="text-center text-2xl font-black">일정 상세</h1>
          <button className="grid h-11 w-11 place-items-center" disabled title="MVP 제외 기능입니다." aria-label="더보기"><MoreHorizontal size={28} /></button>
        </header>
        <section className="space-y-4 px-4">
          <Card className="p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <ColorDot color={event.calendarColor} className="mt-2 h-4 w-4" />
                <div className="min-w-0">
                  <h2 className="truncate text-3xl font-black">{event.title}</h2>
                  <p className="mt-2 text-base font-semibold text-slate-500">{event.calendarName}</p>
                </div>
              </div>
              <Badge color={event.source === "SYSTEM_HOLIDAY" ? "slate" : ["OWNER", "ADMIN", "EDITOR"].includes(event.role) ? "green" : "slate"}>{event.source === "SYSTEM_HOLIDAY" ? "읽기 전용" : ["OWNER", "ADMIN", "EDITOR"].includes(event.role) ? "편집 가능" : "보기"}</Badge>
            </div>
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <MobileDetailRow icon={<CalendarDays size={22} />} label="일시" value={event.isAllDay ? `종일 · ${toKoreanFullDate(new Date(event.startsAt))}` : `${toKoreanFullDate(new Date(event.startsAt))} ${formatTime(event.startsAt)} - ${formatTime(event.endsAt)}`} />
              {event.location ? <MobileDetailRow icon={<MapPin size={22} />} label="장소" value={event.location} /> : null}
              {event.description ? <MobileDetailRow icon={<FileText size={22} />} label="설명" value={event.description} /> : null}
              <MobileDetailRow icon={<UserCircle size={22} />} label="생성자" value={event.creatorName || "알 수 없음"} />
              <MobileDetailRow icon={<CalendarCheck2 size={22} />} label="캘린더" value={event.calendarName} color={event.calendarColor} />
            </div>
            {event.source === "SYSTEM_HOLIDAY" ? <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-6 text-[#0B3B91]"><Info className="mr-2 inline" size={18} />공휴일 일정은 시스템에서 자동 관리됩니다. 이 일정은 수정하거나 삭제할 수 없습니다.</div> : null}
            {!readonly ? (
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
                <Button variant="secondary" onClick={() => router.push(`/mobile/events/${event.id}/edit`)}><Pencil size={18} />수정</Button>
                <Button variant="danger" disabled={saving} onClick={remove}><Trash2 size={18} />{saving ? "삭제 중..." : "삭제"}</Button>
              </div>
            ) : null}
          </Card>
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">참석자</h2>
              <Badge color="blue">{attendees.length}명</Badge>
            </div>
            <div className="space-y-2">
              {attendees.map((attendee) => (
                <div key={attendeeKey(attendee)} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                  <AvatarGroup attendees={[attendee]} size="md" max={1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{attendee.displayName || attendee.email}</p>
                    <p className="truncate text-xs text-slate-500">{attendee.email}</p>
                  </div>
                  <Badge color={attendeeStatusColor(attendee.responseStatus)}>{attendeeStatusLabel(attendee.responseStatus)}</Badge>
                </div>
              ))}
              {attendees.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">등록된 참석자가 없습니다.</p> : null}
            </div>
            {myAttendee && event.source !== "SYSTEM_HOLIDAY" ? (
              <label className="block space-y-2">
                <span className="text-sm font-bold">내 참석 응답</span>
                <Select disabled={saving} value={myAttendee.responseStatus} onChange={(selectEvent) => updateRsvp(selectEvent.target.value as AttendeeResponseStatus)}>
                  <option value="NEEDS_ACTION">응답 필요</option>
                  <option value="ACCEPTED">참석</option>
                  <option value="DECLINED">불참</option>
                  <option value="TENTATIVE">미정</option>
                </Select>
              </label>
            ) : null}
          </Card>
          {message ? <div className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</div> : null}
          {error ? <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
          <Button variant="secondary" className="w-full" onClick={() => router.back()}>닫기</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[430px] bg-[#f6f8fb] pb-8 text-slate-950">
      <MobileStatusBar />
      <header className="grid grid-cols-[44px_1fr_54px] items-center bg-white px-5 pb-5">
        <button className="grid h-11 w-11 place-items-center" onClick={() => router.back()} aria-label="뒤로"><ChevronLeft size={30} /></button>
        <h1 className="text-center text-2xl font-black">{eventId ? "일정 수정" : "새 일정"}</h1>
        <button disabled={readonly || saving || !title.trim()} onClick={save} className="text-base font-black text-[#0B3B91] disabled:text-slate-300">{saving ? "저장 중" : "저장"}</button>
      </header>
      <section className="space-y-4 px-4">
        <Card className="space-y-5 p-5">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-600">제목</span>
            <Input disabled={readonly} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 팀 회의" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-600">캘린더 선택</span>
            <Select disabled={readonly || !!eventId} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>{calendars.filter((calendar) => !calendar.isReadonly && ["OWNER", "ADMIN", "EDITOR"].includes(calendar.role)).map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name} · {calendar.role}</option>)}</Select>
          </label>
          <div className="flex items-center justify-between border-y border-slate-100 py-4">
            <div>
              <p className="text-lg font-black">종일 여부</p>
              <p className="mt-1 text-sm text-slate-500">하루 종일 진행되는 일정</p>
            </div>
            <label className={`relative h-8 w-14 rounded-full transition ${isAllDay ? "bg-[#0B3B91]" : "bg-slate-200"}`}>
              <input type="checkbox" className="sr-only" checked={isAllDay} disabled={readonly} onChange={(e) => setIsAllDay(e.target.checked)} />
              <span className={`absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow transition ${isAllDay ? "left-7" : "left-1"}`} />
            </label>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <MobileFormRow label="시작일"><Input disabled={readonly} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></MobileFormRow>
            {!isAllDay ? <MobileFormRow label="시작시간"><Input disabled={readonly} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></MobileFormRow> : null}
            <MobileFormRow label="종료일"><Input disabled={readonly} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></MobileFormRow>
            {!isAllDay ? <MobileFormRow label="종료시간"><Input disabled={readonly} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></MobileFormRow> : null}
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-600">장소</span>
            <Input disabled={readonly} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 회의실 A" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-600">설명</span>
            <Textarea disabled={readonly} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="회의 안건을 입력하세요." />
          </label>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black">참석자</span>
            {readonly ? <Badge color="slate">수정 불가</Badge> : <Badge color="blue">{attendees.length}명</Badge>}
          </div>
          <div className="flex gap-2">
            <Input
              disabled={readonly || saving}
              value={attendeeEmail}
              onChange={(inputEvent) => setAttendeeEmail(inputEvent.target.value)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter") {
                  keyEvent.preventDefault();
                  if (!readonly) addLocalAttendee();
                }
              }}
              placeholder="참석자 이메일"
            />
            <Button variant="secondary" disabled={readonly || saving || !attendeeEmail.trim()} onClick={addLocalAttendee}>추가</Button>
          </div>
          <p className="text-xs text-slate-500">가입되어 있고 이 캘린더에 접근 권한이 있는 사용자만 저장됩니다.</p>
          <div className="space-y-2">
            {attendees.map((attendee) => (
              <div key={attendeeKey(attendee)} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                <AvatarGroup attendees={[attendee]} size="md" max={1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{attendee.displayName || attendee.email}</p>
                  <p className="truncate text-xs text-slate-500">{attendee.email}</p>
                </div>
                <Badge color={attendeeStatusColor(attendee.responseStatus)}>{attendeeStatusLabel(attendee.responseStatus)}</Badge>
                {!readonly ? <Button variant="ghost" className="min-h-8 px-2" onClick={() => setAttendees((items) => items.filter((item) => attendeeKey(item) !== attendeeKey(attendee)))}>제거</Button> : null}
              </div>
            ))}
            {attendees.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">추가된 참석자가 없습니다.</p> : null}
          </div>
        </Card>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-[#0B3B91]"><Info className="mr-2 inline" size={18} />편집 권한이 있는 캘린더에만 일정을 만들거나 수정할 수 있습니다.</div>
        {error ? <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <Button className="w-full" disabled={readonly || saving || !title.trim()} onClick={save}>{saving ? "저장 중..." : "저장"}</Button>
        {eventId && !readonly ? <Button variant="danger" className="w-full" disabled={saving} onClick={remove}><Trash2 size={18} />{saving ? "삭제 중..." : "삭제"}</Button> : null}
      </section>
    </main>
  );
}

function MobileDetailRow({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="grid grid-cols-[42px_92px_1fr] items-center gap-2 text-base">
      <span className="text-slate-400">{icon}</span>
      <span className="font-bold text-slate-500">{label}</span>
      <span className="min-w-0 font-semibold text-slate-900">{color ? <ColorDot color={color} className="mr-2" /> : null}{value}</span>
    </div>
  );
}

function MobileFormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[94px_1fr] items-center border-b border-slate-100 bg-white px-3 py-3 last:border-b-0">
      <span className="font-black text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function eventsForDate(events: CalendarEvent[], date: Date) {
  return events.filter((event) => {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = addDays(dayStart, 1);
    return end > dayStart && start < dayEnd;
  });
}

function isHolidayDate(events: CalendarEvent[], date: Date) {
  return eventsForDate(events, date).some((event) => event.source === "SYSTEM_HOLIDAY");
}

function toKoreanFullDate(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function mockSubDate(date: Date) {
  const start = new Date(date.getFullYear(), 4, 1);
  const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86400000);
  const sub = addDays(new Date(2026, 2, 15), diff);
  return `${sub.getMonth() + 1}/${sub.getDate()}`;
}

function eventDurationLabel(event: CalendarEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

function attendeeKey(attendee: EventAttendee) {
  return attendee.id || attendee.email.toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function attendeeStatusLabel(status: AttendeeResponseStatus) {
  if (status === "ACCEPTED") return "참석";
  if (status === "DECLINED") return "불참";
  if (status === "TENTATIVE") return "미정";
  return "응답 필요";
}

function attendeeStatusColor(status: AttendeeResponseStatus): "slate" | "blue" | "green" | "purple" | "amber" | "rose" {
  if (status === "ACCEPTED") return "green";
  if (status === "DECLINED") return "rose";
  if (status === "TENTATIVE") return "amber";
  return "slate";
}

async function syncMobileAttendeeChanges(eventId: string, original: EventAttendee[], desired: EventAttendee[]) {
  const desiredEmails = new Set(desired.map((attendee) => attendee.email.toLowerCase()));
  const originalEmails = new Set(original.map((attendee) => attendee.email.toLowerCase()));
  for (const attendee of original.filter((item) => !desiredEmails.has(item.email.toLowerCase()))) {
    await api.removeAttendee(eventId, attendee.id);
  }
  for (const attendee of desired.filter((item) => !originalEmails.has(item.email.toLowerCase()))) {
    await api.addAttendee(eventId, attendee.email);
  }
}
