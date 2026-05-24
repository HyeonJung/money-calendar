"use client";

import { api, clearToken, type EventInput } from "@/lib/api";
import { addDays, addMonths, dateKey, dayRange, formatTime, isAllDayDateRangeValid, isoAt, monthGrid, monthRange, sameDate, startOfWeek, toInclusiveAllDayEndDate, toInputDate, toKoreanDate, weekRange, WEEKDAYS } from "@/lib/date";
import type { AttendeeResponseStatus, Calendar, CalendarEvent, EventAttendee, User, Visibility } from "@/types/calendar";
import { AvatarGroup, Badge, Button, CalendarRow, Card, ColorDot, EmptyState, Input, PermissionHint, RoleBadge, Select, Textarea, palette } from "@/components/ui";
import { CalendarDays, ChevronLeft, ChevronRight, LogOut, Plus, Search, Settings, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MouseEventHandler } from "react";
import { useCallback, useEffect, useState } from "react";

type ViewMode = "month" | "week" | "day";

const HOURS = Array.from({ length: 18 }, (_, index) => index + 6);

export function CalendarClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidayEvents, setHolidayEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date(2026, 4, 24));
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 4, 24));
  const [readyForDesktop, setReadyForDesktop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventModal, setEventModal] = useState<{ mode: "create" | "edit"; date?: Date; event?: CalendarEvent } | null>(null);
  const [calendarModal, setCalendarModal] = useState<{ mode: "create" | "edit"; calendar?: Calendar } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.matchMedia("(max-width: 767px)").matches && params.get("desktop") !== "1") {
      router.replace("/mobile/calendar");
      return;
    }
    setReadyForDesktop(true);
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextView = params.get("view");
    if (nextView === "week" || nextView === "day" || nextView === "month") setView(nextView);
  }, []);

  const load = useCallback(async () => {
    if (!readyForDesktop) return;
    setLoading(true);
    setError("");
    try {
      const me = await api.me();
      setUser(me);
      const nextCalendars = await api.calendars(true);
      setCalendars(nextCalendars);
      const range = view === "month" ? monthRange(cursor) : view === "week" ? weekRange(cursor) : dayRange(cursor);
      const nextEvents = await api.events({ ...range, calendarIds: nextCalendars.filter((c) => c.subscriptionStatus === "SUBSCRIBED").map((c) => c.id), view: view.toUpperCase() });
      setEvents(nextEvents);
      const holidayCalendarIds = nextCalendars.filter((calendar) => calendar.type === "SYSTEM_HOLIDAY").map((calendar) => calendar.id);
      setHolidayEvents(holidayCalendarIds.length ? await api.events({ ...range, calendarIds: holidayCalendarIds, view: view.toUpperCase() }) : []);
    } catch (err) {
      if (err instanceof Error && err.message.includes("인증")) {
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, readyForDesktop, router, view]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleCalendar(calendar: Calendar) {
    const next = calendar.subscriptionStatus === "SUBSCRIBED" ? "HIDDEN" : "SUBSCRIBED";
    setCalendars((items) => items.map((item) => (item.id === calendar.id ? { ...item, subscriptionStatus: next } : item)));
    await api.updateSubscription(calendar.id, next);
    await load();
  }

  function changeView(next: ViewMode) {
    setView(next);
    window.history.replaceState(null, "", `/calendar?view=${next}`);
  }

  function move(delta: number) {
    if (view === "month") setCursor((date) => addMonths(date, delta));
    if (view === "week") setCursor((date) => addDays(date, delta * 7));
    if (view === "day") {
      setCursor((date) => addDays(date, delta));
      setSelectedDate((date) => addDays(date, delta));
    }
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  const selectedEvents = eventsForDate(events, selectedDate);

  if (!readyForDesktop) {
    return <main className="grid min-h-screen place-items-center bg-white text-sm font-bold text-slate-500">모바일 캘린더로 이동하는 중...</main>;
  }

  return (
    <main className="flex min-h-screen bg-[#f6f8fb]">
      <MiniRail />
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 px-5 py-6 xl:block">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0B3B91] text-white">
            <CalendarDays size={20} />
          </span>
          <h1 className="text-xl font-extrabold">캘린더</h1>
        </div>
        <Button className="mb-3 w-full" onClick={() => setEventModal({ mode: "create", date: selectedDate })}>
          <Plus size={18} /> 새 일정
        </Button>
        <Button variant="secondary" className="mb-5 w-full" onClick={() => setCalendarModal({ mode: "create" })}>
          <CalendarDays size={16} /> 캘린더 추가
        </Button>
        <MiniMonth date={cursor} selectedDate={selectedDate} onSelect={setSelectedDate} />
        <CalendarGroup title="내 캘린더" calendars={calendars.filter((c) => c.type === "USER" && c.role === "OWNER")} onToggle={toggleCalendar} />
        <CalendarGroup title="공유받은 캘린더" calendars={calendars.filter((c) => c.type === "USER" && c.role !== "OWNER")} onToggle={toggleCalendar} />
        <CalendarGroup title="시스템 캘린더" calendars={calendars.filter((c) => c.type === "SYSTEM_HOLIDAY")} onToggle={toggleCalendar} />
        <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-bold">대한민국 공휴일</p>
          <p className="mt-1 leading-6">읽기 전용 시스템 캘린더로 자동 표시됩니다.</p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <Button variant="secondary" onClick={() => setCursor(new Date())}>오늘</Button>
          <Button variant="ghost" onClick={() => move(-1)} aria-label="이전"><ChevronLeft /></Button>
          <Button variant="ghost" onClick={() => move(1)} aria-label="다음"><ChevronRight /></Button>
          <h2 className={`min-w-0 flex-1 text-xl font-extrabold lg:text-2xl ${view === "day" && isHolidayDate(holidayEvents, cursor) ? "text-rose-600" : ""}`}>{periodTitle(cursor, view)}</h2>
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-1 md:flex">
            {(["month", "week", "day"] as ViewMode[]).map((item) => (
              <button
                key={item}
                onClick={() => changeView(item)}
                className={`min-w-14 rounded-xl px-4 py-2 text-sm font-bold ${view === item ? "bg-[#0B3B91] text-white" : "text-slate-600"}`}
              >
                {item === "month" ? "월" : item === "week" ? "주" : "일"}
              </button>
            ))}
          </div>
          <Button variant="ghost" aria-label="검색" disabled title="MVP 제외 기능입니다."><Search /></Button>
          <Button variant="ghost" onClick={() => router.push("/calendar/settings")} aria-label="설정"><Settings /></Button>
          <Button variant="ghost" onClick={logout}><LogOut size={18} /> {user?.displayName || "사용자"}</Button>
        </header>

        {error ? <div className="m-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        {loading ? <div className="p-8 text-slate-500">캘린더를 불러오는 중...</div> : null}
        {!loading && view === "month" ? (
          <MonthView cursor={cursor} selectedDate={selectedDate} events={events} holidayEvents={holidayEvents} onSelectDate={setSelectedDate} onNew={(date) => setEventModal({ mode: "create", date })} onEvent={setSelectedEvent} />
        ) : null}
        {!loading && view === "week" ? (
          <WeekView cursor={cursor} events={events} holidayEvents={holidayEvents} onNew={(date) => setEventModal({ mode: "create", date })} onEvent={setSelectedEvent} />
        ) : null}
        {!loading && view === "day" ? (
          <DayView cursor={cursor} events={eventsForDate(events, cursor)} isHoliday={isHolidayDate(holidayEvents, cursor)} onNew={(date) => setEventModal({ mode: "create", date })} onEvent={setSelectedEvent} />
        ) : null}
      </section>

      <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white p-5 2xl:block">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{toKoreanDate(selectedDate)} 일정</h3>
          <span className="text-sm text-slate-500">{selectedEvents.length}개</span>
        </div>
        <div className="space-y-3">
          {selectedEvents.map((event) => <EventCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)}
          {selectedEvents.length === 0 ? <EmptyState title="이 날짜에는 일정이 없습니다." /> : null}
        </div>
        <Button variant="secondary" className="mt-5 w-full" onClick={() => setEventModal({ mode: "create", date: selectedDate })}>
          <Plus size={17} /> 새 일정 만들기
        </Button>
      </aside>

      {eventModal ? (
        <EventModal
          modal={eventModal}
          calendars={calendars.filter((c) => c.subscriptionStatus === "SUBSCRIBED")}
          onClose={() => setEventModal(null)}
          onSaved={async () => {
            setEventModal(null);
            await load();
          }}
        />
      ) : null}
      {calendarModal ? (
        <CalendarModal
          modal={calendarModal}
          onClose={() => setCalendarModal(null)}
          onSaved={async () => {
            setCalendarModal(null);
            await load();
          }}
        />
      ) : null}
      {selectedEvent ? (
        <EventPanel
          event={selectedEvent}
          currentUserId={user?.id}
          onClose={() => setSelectedEvent(null)}
          onEdit={(event) => {
            setEventModal({ mode: "edit", event });
            setSelectedEvent(null);
          }}
          onDeleted={async () => {
            setSelectedEvent(null);
            await load();
          }}
        />
      ) : null}
    </main>
  );
}

function MiniRail() {
  return (
    <nav className="hidden w-16 shrink-0 flex-col items-center gap-5 border-r border-slate-200 bg-white py-5 lg:flex">
      <a className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0B3B91] text-white" href="/calendar"><CalendarDays size={20} /></a>
      <a className="grid h-10 w-10 place-items-center rounded-2xl text-slate-500 hover:bg-slate-100" href="/calendar/settings"><Settings size={20} /></a>
    </nav>
  );
}

function CalendarGroup({ title, calendars, onToggle }: { title: string; calendars: Calendar[]; onToggle: (calendar: Calendar) => void }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400">{calendars.length}</span>
      </div>
      <div>{calendars.map((calendar) => <CalendarRow key={calendar.id} calendar={calendar} onToggle={onToggle} />)}</div>
    </section>
  );
}

function MiniMonth({ date, selectedDate, onSelect }: { date: Date; selectedDate: Date; onSelect: (date: Date) => void }) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-center text-sm font-extrabold">{date.getFullYear()}년 {date.getMonth() + 1}월</div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        {monthGrid(date).map((day) => (
          <button
            key={dateKey(day)}
            onClick={() => onSelect(day)}
            className={`rounded-full py-1 text-xs font-semibold ${sameDate(day, selectedDate) ? "bg-[#0B3B91] text-white" : "text-slate-600"}`}
          >
            {day.getDate()}
          </button>
        ))}
      </div>
    </Card>
  );
}

function MonthView({
  cursor,
  selectedDate,
  events,
  holidayEvents,
  onSelectDate,
  onNew,
  onEvent,
}: {
  cursor: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  holidayEvents: CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onNew: (date: Date) => void;
  onEvent: (event: CalendarEvent) => void;
}) {
  const days = monthGrid(cursor);
  const today = new Date();
  return (
    <div className="flex-1 overflow-auto p-3 lg:p-5">
      <div className="grid min-w-[900px] grid-cols-7 border-l border-t border-slate-200 bg-white">
        {WEEKDAYS.map((day, index) => <div key={day} className={`border-b border-r border-slate-200 py-3 text-center text-sm font-extrabold ${index === 0 ? "text-rose-500" : index === 6 ? "text-blue-500" : "text-slate-600"}`}>{day}</div>)}
        {days.map((day) => {
          const dayEvents = eventsForDate(events, day);
          const holiday = isHolidayDate(holidayEvents, day);
          const visible = dayEvents.slice(0, 3);
          return (
            <div key={dateKey(day)} onClick={() => onSelectDate(day)} className={`min-h-36 border-b border-r border-slate-200 p-3 ${day.getMonth() !== cursor.getMonth() ? "bg-slate-50/60 text-slate-300" : "bg-white"} ${sameDate(day, selectedDate) ? "ring-2 ring-inset ring-[#0B3B91]" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <button onClick={(event) => { event.stopPropagation(); onNew(day); }} className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-bold ${sameDate(day, today) ? "bg-[#0B3B91] text-white" : day.getDay() === 0 || holiday ? "text-rose-500" : day.getDay() === 6 ? "text-blue-500" : "text-slate-800"}`}>
                  {day.getDate()}
                </button>
              </div>
              <div className="space-y-1">
                {visible.map((event) => (
                  <button key={event.id} onClick={(click) => { click.stopPropagation(); onEvent(event); }} className={`flex w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-xs font-semibold ${event.source === "SYSTEM_HOLIDAY" ? "bg-rose-50 text-rose-600" : "hover:bg-slate-50"}`}>
                    <ColorDot color={event.calendarColor} className="h-2 w-2" />
                    <span className="min-w-0 flex-1 truncate">{event.isAllDay ? "" : formatTime(event.startsAt)} {event.title}</span>
                    <AvatarGroup attendees={event.attendeePreview} count={event.attendeeCount} size="sm" max={2} />
                  </button>
                ))}
                {dayEvents.length > 3 ? <span className="block text-xs font-bold text-slate-500">+{dayEvents.length - 3}개 더보기</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, events, holidayEvents, onNew, onEvent }: { cursor: Date; events: CalendarEvent[]; holidayEvents: CalendarEvent[]; onNew: (date: Date) => void; onEvent: (event: CalendarEvent) => void }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="min-w-[980px] rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-slate-200">
          <div />
          {days.map((day) => {
            const holiday = isHolidayDate(holidayEvents, day);
            return (
              <div key={dateKey(day)} className={`border-l border-slate-200 p-3 text-center font-extrabold ${day.getDay() === 0 || holiday ? "text-rose-600" : day.getDay() === 6 ? "text-blue-600" : "text-slate-800"}`}>
                {WEEKDAYS[day.getDay()]} {day.getDate()}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[72px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-slate-100 p-2 text-xs text-slate-400">{String(hour).padStart(2, "0")}:00</div>
              {days.map((day) => {
                const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
                const slotEvents = eventsForDate(events, day).filter((event) => new Date(event.startsAt).getHours() === hour);
                return (
                  <button key={`${dateKey(day)}-${hour}`} onClick={() => onNew(slotDate)} className="min-h-16 border-b border-l border-slate-100 p-1 text-left hover:bg-blue-50/50">
                    {slotEvents.map((event) => <EventPill key={event.id} event={event} onClick={(e) => { e.stopPropagation(); onEvent(event); }} />)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayView({ cursor, events, isHoliday, onNew, onEvent }: { cursor: Date; events: CalendarEvent[]; isHoliday: boolean; onNew: (date: Date) => void; onEvent: (event: CalendarEvent) => void }) {
  return (
    <div className="grid flex-1 gap-5 overflow-auto p-5 xl:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-200 bg-white">
        {HOURS.map((hour) => {
          const slotDate = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hour);
          const slotEvents = events.filter((event) => new Date(event.startsAt).getHours() === hour);
          return (
            <button key={hour} onClick={() => onNew(slotDate)} className="grid min-h-20 w-full grid-cols-[80px_1fr] border-b border-slate-100 text-left hover:bg-blue-50/50">
              <div className="p-3 text-sm font-semibold text-slate-400">{String(hour).padStart(2, "0")}:00</div>
              <div className="p-2">
                {slotEvents.length ? slotEvents.map((event) => <EventPill key={event.id} event={event} onClick={(e) => { e.stopPropagation(); onEvent(event); }} />) : <span className="text-xs text-slate-300">이 시간대에는 일정이 없습니다.</span>}
              </div>
            </button>
          );
        })}
      </div>
      <Card className="h-fit p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-lg font-extrabold ${isHoliday ? "text-rose-600" : ""}`}>오늘 일정 요약</h3>
          {isHoliday ? <Badge color="rose">공휴일</Badge> : null}
        </div>
        <div className="space-y-3">{events.map((event) => <EventCard key={event.id} event={event} onClick={() => onEvent(event)} />)}</div>
      </Card>
    </div>
  );
}

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: MouseEventHandler<HTMLDivElement> }) {
  return (
    <div onClick={onClick} className="mb-1 flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-bold text-white shadow-sm" style={{ backgroundColor: event.calendarColor }}>
      <span className="min-w-0 flex-1 truncate">{event.isAllDay ? "종일" : formatTime(event.startsAt)} {event.title}</span>
      <AvatarGroup attendees={event.attendeePreview} count={event.attendeeCount} size="sm" max={2} />
    </div>
  );
}

function EventCard({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ColorDot color={event.calendarColor} />
          <strong>{event.title}</strong>
        </div>
        {event.source === "SYSTEM_HOLIDAY" ? <Badge color="rose">공휴일</Badge> : null}
      </div>
      <p className="text-sm text-slate-500">{event.isAllDay ? "종일" : `${formatTime(event.startsAt)} - ${formatTime(event.endsAt)}`}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-slate-500">{event.calendarName}</p>
        <AvatarGroup attendees={event.attendeePreview} count={event.attendeeCount} size="md" />
      </div>
    </button>
  );
}

function EventModal({ modal, calendars, onClose, onSaved }: { modal: { mode: "create" | "edit"; date?: Date; event?: CalendarEvent }; calendars: Calendar[]; onClose: () => void; onSaved: () => void }) {
  const editableCalendars = calendars.filter((calendar) => !calendar.isReadonly && ["OWNER", "ADMIN", "EDITOR"].includes(calendar.role));
  const initialDate = modal.event ? new Date(modal.event.startsAt) : modal.date || new Date();
  const [calendarId, setCalendarId] = useState(modal.event?.calendarId || editableCalendars[0]?.id || "");
  const [title, setTitle] = useState(modal.event?.title || "");
  const [isAllDay, setIsAllDay] = useState(modal.event?.isAllDay || false);
  const [startDate, setStartDate] = useState(toInputDate(initialDate));
  const [startTime, setStartTime] = useState(modal.event ? formatTime(modal.event.startsAt) : "10:00");
  const [endDate, setEndDate] = useState(modal.event ? modal.event.isAllDay ? toInclusiveAllDayEndDate(modal.event.endsAt) : toInputDate(new Date(modal.event.endsAt)) : toInputDate(initialDate));
  const [endTime, setEndTime] = useState(modal.event ? formatTime(modal.event.endsAt) : "11:00");
  const [location, setLocation] = useState(modal.event?.location || "");
  const [description, setDescription] = useState(modal.event?.description || "");
  const [attendees, setAttendees] = useState<EventAttendee[]>(modal.event?.attendees || modal.event?.attendeePreview || []);
  const [originalAttendees, setOriginalAttendees] = useState<EventAttendee[]>(modal.event?.attendees || []);
  const [attendeesReady, setAttendeesReady] = useState(modal.mode === "create" || Boolean(modal.event?.attendees));
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId);
  const readonly = modal.event?.source === "SYSTEM_HOLIDAY" || selectedCalendar?.isReadonly || selectedCalendar?.role === "VIEWER";

  useEffect(() => {
    let ignore = false;
    if (modal.mode !== "edit" || !modal.event || modal.event.attendees) return;
    setAttendeesReady(false);
    api.event(modal.event.id).then((detail) => {
      if (ignore) return;
      const nextAttendees = detail.attendees || [];
      setAttendees(nextAttendees);
      setOriginalAttendees(nextAttendees);
      setAttendeesReady(true);
    }).catch(() => {
      if (!ignore) setAttendeesReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [modal.event, modal.mode]);

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
        eventId: modal.event?.id || "new",
        userId: "",
        email,
        displayName: email,
        responseStatus: "NEEDS_ACTION",
        pending: true,
      },
    ]);
    setAttendeeEmail("");
  }

  function removeLocalAttendee(attendee: EventAttendee) {
    setAttendees((items) => items.filter((item) => attendeeKey(item) !== attendeeKey(attendee)));
  }

  async function save() {
    setError("");
    const startsAt = isoAt(startDate, isAllDay ? "00:00" : startTime);
    const endsAt = isoAt(endDate, isAllDay ? "00:00" : endTime);
    if (isAllDay && !isAllDayDateRangeValid(startDate, endDate)) {
      setError("종료일은 시작일과 같거나 이후여야 합니다.");
      return;
    }
    if (!isAllDay && new Date(endsAt) <= new Date(startsAt)) {
      setError("종료 시간은 시작 시간보다 이후여야 합니다.");
      return;
    }
    if (!calendarId) {
      setError("편집 권한이 있는 캘린더에만 일정을 만들 수 있습니다.");
      return;
    }
    const input: EventInput = { calendarId, title, description, location, startsAt, endsAt, timezone: "Asia/Seoul", isAllDay };
    if (!attendeesReady) {
      setError("참석자 정보를 불러오는 중입니다. 잠시 후 다시 저장해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const saved = modal.mode === "edit" && modal.event ? await api.updateEvent(modal.event.id, input) : await api.createEvent(input);
      if (!readonly) await syncAttendeeChanges(saved.id, originalAttendees, attendees);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!modal.event || !confirm("일정을 삭제할까요?")) return;
    setSaving(true);
    try {
      await api.deleteEvent(modal.event.id);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-4">
      <Card className="w-full max-w-xl p-7">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">{modal.mode === "create" ? "새 일정 만들기" : "일정 수정"}</h2>
          <button onClick={onClose} aria-label="닫기"><X /></button>
        </div>
        <div className="grid gap-4">
          <label className="space-y-2"><span className="text-sm font-bold">제목 *</span><Input disabled={readonly} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 팀 회의" /></label>
          <label className="space-y-2"><span className="text-sm font-bold">캘린더 *</span><Select disabled={readonly || modal.mode === "edit"} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>{editableCalendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name} · {calendar.role}</option>)}</Select></label>
          <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={isAllDay} disabled={readonly} onChange={(e) => setIsAllDay(e.target.checked)} /> 종일 일정</label>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2"><span className="text-sm font-bold">시작일</span><Input disabled={readonly} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label className="space-y-2"><span className="text-sm font-bold">종료일</span><Input disabled={readonly} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
            {!isAllDay ? <label className="space-y-2"><span className="text-sm font-bold">시작시간</span><Input disabled={readonly} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label> : null}
            {!isAllDay ? <label className="space-y-2"><span className="text-sm font-bold">종료시간</span><Input disabled={readonly} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label> : null}
          </div>
          <label className="space-y-2"><span className="text-sm font-bold">장소</span><Input disabled={readonly} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 회의실 A" /></label>
          <label className="space-y-2"><span className="text-sm font-bold">설명</span><Textarea disabled={readonly} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="회의 안건을 입력하세요." /></label>
          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">참석자</span>
              {readonly ? <Badge color="slate">수정 불가</Badge> : <Badge color="blue">{attendees.length}명</Badge>}
            </div>
            <div className="flex gap-2">
              <Input
                disabled={readonly || saving}
                value={attendeeEmail}
                onChange={(event) => setAttendeeEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!readonly) addLocalAttendee();
                  }
                }}
                placeholder="참석자 이메일"
              />
              <Button variant="secondary" disabled={readonly || saving || !attendeeEmail.trim()} onClick={addLocalAttendee}>추가</Button>
            </div>
            <p className="text-xs text-slate-500">가입되어 있고 이 캘린더에 접근 권한이 있는 사용자만 참석자로 저장됩니다.</p>
            <div className="space-y-2">
              {attendees.map((attendee) => (
                <div key={attendeeKey(attendee)} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                  <AvatarGroup attendees={[attendee]} size="md" max={1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{attendee.displayName || attendee.email}</p>
                    <p className="truncate text-xs text-slate-500">{attendee.email}</p>
                  </div>
                  <Badge color={attendeeStatusColor(attendee.responseStatus)}>{attendeeStatusLabel(attendee.responseStatus)}</Badge>
                  {!readonly ? <Button variant="ghost" className="min-h-8 px-2" onClick={() => removeLocalAttendee(attendee)} aria-label={`${attendee.email} 참석자 제거`}>제거</Button> : null}
                </div>
              ))}
              {attendees.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">추가된 참석자가 없습니다.</p> : null}
            </div>
          </section>
          <PermissionHint calendar={selectedCalendar} />
          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
          <div className="mt-2 flex justify-end gap-3">
            {modal.mode === "edit" && !readonly ? <Button variant="danger" disabled={saving} onClick={remove}>삭제</Button> : null}
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button disabled={saving || readonly || !title.trim()} onClick={save}>{saving ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CalendarModal({ modal, onClose, onSaved }: { modal: { mode: "create" | "edit"; calendar?: Calendar }; onClose: () => void; onSaved: () => void }) {
  const calendar = modal.calendar;
  const [name, setName] = useState(calendar?.name || "");
  const [color, setColor] = useState(calendar?.color || "#2563EB");
  const [description, setDescription] = useState(calendar?.description || "");
  const [visibility, setVisibility] = useState<Visibility>(calendar?.visibility || "PRIVATE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const readonly = calendar?.type === "SYSTEM_HOLIDAY";

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (modal.mode === "edit" && calendar) await api.updateCalendar(calendar.id, { name, color, description, visibility });
      else await api.createCalendar({ name, color, description, visibility });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!calendar || !confirm("캘린더와 일정을 삭제할까요?")) return;
    setSaving(true);
    try {
      await api.deleteCalendar(calendar.id);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-4">
      <Card className="w-full max-w-lg p-7">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">{modal.mode === "create" ? "새 캘린더 만들기" : "캘린더 수정"}</h2>
          <button onClick={onClose} aria-label="닫기"><X /></button>
        </div>
        <div className="space-y-4">
          {readonly ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">시스템 공휴일 캘린더는 수정할 수 없습니다.</div> : null}
          <label className="space-y-2"><span className="text-sm font-bold">캘린더 이름</span><Input disabled={readonly} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="space-y-2">
            <span className="text-sm font-bold">색상</span>
            <div className="flex flex-wrap gap-2">{palette.map((item) => <button key={item.value} disabled={readonly} onClick={() => setColor(item.value)} className={`h-9 w-9 rounded-full border-4 ${color === item.value ? "border-slate-900" : "border-white"}`} style={{ backgroundColor: item.value }} aria-label={item.name} />)}</div>
          </div>
          <label className="space-y-2"><span className="text-sm font-bold">설명</span><Textarea disabled={readonly} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="space-y-2"><span className="text-sm font-bold">공개상태</span><Select disabled={readonly} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}><option value="PRIVATE">비공개</option><option value="LINK">링크 접근 가능</option><option value="PUBLIC">공개</option></Select></label>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">MVP에서는 비공개 캘린더를 기본으로 사용합니다.</div>
          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
          <div className="flex justify-end gap-3">
            {modal.mode === "edit" && calendar?.role === "OWNER" && !readonly ? <Button variant="danger" onClick={remove} disabled={saving}>캘린더 삭제</Button> : null}
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button onClick={save} disabled={saving || readonly || !name.trim()}>{saving ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EventPanel({
  event,
  currentUserId,
  onClose,
  onEdit,
  onDeleted,
}: {
  event: CalendarEvent;
  currentUserId?: string;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<CalendarEvent>(event);
  const [deleting, setDeleting] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = !detail.isReadonly && detail.source !== "SYSTEM_HOLIDAY" && ["OWNER", "ADMIN", "EDITOR"].includes(detail.role);
  const myAttendee = detail.attendees?.find((attendee) => attendee.userId === currentUserId);

  useEffect(() => {
    let ignore = false;
    setDetail(event);
    api.event(event.id).then((next) => {
      if (!ignore) setDetail(next);
    }).catch((err) => {
      if (!ignore) setMessage(err instanceof Error ? err.message : "일정 상세를 불러오지 못했습니다.");
    });
    return () => {
      ignore = true;
    };
  }, [event]);

  async function remove() {
    if (!confirm("일정을 삭제할까요?")) return;
    setDeleting(true);
    try {
      await api.deleteEvent(detail.id);
      await onDeleted();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function updateRsvp(responseStatus: AttendeeResponseStatus) {
    setRsvpSaving(true);
    setMessage("");
    try {
      await api.updateMyRsvp(detail.id, responseStatus);
      setDetail(await api.event(detail.id));
      setMessage("참석 응답을 저장했습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "응답을 저장하지 못했습니다.");
    } finally {
      setRsvpSaving(false);
    }
  }

  return (
    <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-slate-200 bg-white p-6 shadow-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">일정 상세</h2>
        <button onClick={onClose} aria-label="닫기"><X /></button>
      </div>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <ColorDot color={detail.calendarColor} className="mt-2" />
          <div>
            <h3 className="text-2xl font-extrabold">{detail.title}</h3>
            <p className="mt-1 text-slate-500">{detail.calendarName}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700">{detail.isAllDay ? "종일" : `${formatTime(detail.startsAt)} - ${formatTime(detail.endsAt)}`}</p>
        {detail.location ? <p className="text-sm text-slate-600">장소: {detail.location}</p> : null}
        {detail.description ? <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{detail.description}</p> : null}
        <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold">참석자</h4>
            <Badge color="blue">{detail.attendees?.length || detail.attendeeCount || 0}명</Badge>
          </div>
          <div className="space-y-2">
            {(detail.attendees || detail.attendeePreview || []).map((attendee) => (
              <div key={attendeeKey(attendee)} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                <AvatarGroup attendees={[attendee]} size="md" max={1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{attendee.displayName || attendee.email}</p>
                  <p className="truncate text-xs text-slate-500">{attendee.email}</p>
                </div>
                <Badge color={attendeeStatusColor(attendee.responseStatus)}>{attendeeStatusLabel(attendee.responseStatus)}</Badge>
              </div>
            ))}
            {(detail.attendees || detail.attendeePreview || []).length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">등록된 참석자가 없습니다.</p> : null}
          </div>
          {myAttendee && detail.source !== "SYSTEM_HOLIDAY" ? (
            <label className="block space-y-2">
              <span className="text-sm font-bold">내 참석 응답</span>
              <Select disabled={rsvpSaving} value={myAttendee.responseStatus} onChange={(event) => updateRsvp(event.target.value as AttendeeResponseStatus)}>
                <option value="NEEDS_ACTION">응답 필요</option>
                <option value="ACCEPTED">참석</option>
                <option value="DECLINED">불참</option>
                <option value="TENTATIVE">미정</option>
              </Select>
            </label>
          ) : null}
        </section>
        <div className="flex gap-2"><RoleBadge role={detail.role} /><Badge color={detail.source === "SYSTEM_HOLIDAY" ? "rose" : "blue"}>{detail.source === "SYSTEM_HOLIDAY" ? "읽기 전용" : "사용자 일정"}</Badge></div>
        {detail.source === "SYSTEM_HOLIDAY" ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">공휴일 일정은 시스템에서 자동 관리됩니다.</div> : null}
        {message ? <div className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</div> : null}
        <div className="flex gap-3">
          {canEdit ? <Button onClick={() => onEdit(detail)}>수정</Button> : null}
          {canEdit ? <Button variant="danger" disabled={deleting} onClick={remove}>{deleting ? "삭제 중..." : "삭제"}</Button> : null}
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </aside>
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

async function syncAttendeeChanges(eventId: string, original: EventAttendee[], desired: EventAttendee[]) {
  const desiredEmails = new Set(desired.map((attendee) => attendee.email.toLowerCase()));
  const originalEmails = new Set(original.map((attendee) => attendee.email.toLowerCase()));
  const removed = original.filter((attendee) => !desiredEmails.has(attendee.email.toLowerCase()));
  const added = desired.filter((attendee) => !originalEmails.has(attendee.email.toLowerCase()));

  for (const attendee of removed) {
    await api.removeAttendee(eventId, attendee.id);
  }
  for (const attendee of added) {
    await api.addAttendee(eventId, attendee.email);
  }
}

function periodTitle(date: Date, view: ViewMode) {
  if (view === "month") return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  if (view === "day") return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, "0")}.${String(start.getDate()).padStart(2, "0")} - ${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, "0")}.${String(end.getDate()).padStart(2, "0")}`;
}
