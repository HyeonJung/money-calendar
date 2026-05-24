import type { AttendeeResponseStatus, Calendar, CalendarEvent, CalendarMember, EventAttendee, HolidayRun, Role, User, Visibility } from "@/types/calendar";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";
const TOKEN_KEY = "calendar_mvp_access_token";

type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
type ApiFailure = { error: { code: string; message: string; details?: unknown[] } };

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in payload) {
    const message = "error" in payload ? payload.error.message : "요청 처리 중 오류가 발생했습니다.";
    throw new Error(message);
  }
  return payload.data;
}

export const api = {
  async register(input: { email: string; password: string; displayName: string }) {
    return request<{ accessToken: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async login(input: { email: string; password: string }) {
    return request<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async me() {
    return request<User>("/me");
  },
  async calendars(includeHidden = true) {
    return request<Calendar[]>(`/calendars?includeHidden=${includeHidden}`);
  },
  async createCalendar(input: { name: string; color: string; description?: string; visibility: Visibility }) {
    return request<Calendar>("/calendars", { method: "POST", body: JSON.stringify(input) });
  },
  async updateCalendar(id: string, input: { name: string; color: string; description?: string; visibility: Visibility }) {
    return request<Calendar>(`/calendars/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteCalendar(id: string) {
    return request<{ deleted: boolean }>(`/calendars/${id}`, { method: "DELETE" });
  },
  async updateSubscription(id: string, subscriptionStatus: "SUBSCRIBED" | "HIDDEN") {
    return request<Calendar>(`/calendars/${id}/subscription`, {
      method: "PATCH",
      body: JSON.stringify({ subscriptionStatus }),
    });
  },
  async events(params: { from: string; to: string; calendarIds?: string[]; view?: string }) {
    const search = new URLSearchParams({ from: params.from, to: params.to, view: params.view || "MONTH" });
    if (params.calendarIds?.length) search.set("calendarIds", params.calendarIds.join(","));
    return request<CalendarEvent[]>(`/events?${search.toString()}`);
  },
  async event(id: string) {
    return request<CalendarEvent>(`/events/${id}`);
  },
  async createEvent(input: EventInput) {
    return request<CalendarEvent>("/events", { method: "POST", body: JSON.stringify(input) });
  },
  async updateEvent(id: string, input: EventInput) {
    return request<CalendarEvent>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  async deleteEvent(id: string) {
    return request<{ deleted: boolean }>(`/events/${id}`, { method: "DELETE" });
  },
  async attendees(eventId: string) {
    return request<EventAttendee[]>(`/events/${eventId}/attendees`);
  },
  async addAttendee(eventId: string, email: string) {
    return request<EventAttendee[]>(`/events/${eventId}/attendees`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  async removeAttendee(eventId: string, attendeeId: string) {
    return request<{ removed: boolean }>(`/events/${eventId}/attendees/${attendeeId}`, { method: "DELETE" });
  },
  async updateMyRsvp(eventId: string, responseStatus: AttendeeResponseStatus) {
    return request<EventAttendee>(`/events/${eventId}/attendees/me/response`, {
      method: "PATCH",
      body: JSON.stringify({ responseStatus }),
    });
  },
  async members(calendarId: string) {
    return request<CalendarMember[]>(`/calendars/${calendarId}/members`);
  },
  async share(calendarId: string, input: { email: string; role: Exclude<Role, "OWNER"> }) {
    return request<CalendarMember[]>(`/calendars/${calendarId}/members`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async updateMember(calendarId: string, userId: string, role: Exclude<Role, "OWNER">) {
    return request<CalendarMember[]>(`/calendars/${calendarId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  async removeMember(calendarId: string, userId: string) {
    return request<{ removed: boolean }>(`/calendars/${calendarId}/members/${userId}`, { method: "DELETE" });
  },
  async holidayRuns(year = 2026, status = "ALL") {
    return request<HolidayRun[]>(`/admin/holiday-sync-runs?countryCode=KR&year=${year}&status=${status}`);
  },
  async holidayRun(id: string) {
    return request<HolidayRun>(`/admin/holiday-sync-runs/${id}`);
  },
  async runHolidaySync(year = 2026) {
    return request<HolidayRun>("/admin/holiday-sync-runs", {
      method: "POST",
      body: JSON.stringify({ countryCode: "KR", year }),
    });
  },
};

export type EventInput = {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
};
