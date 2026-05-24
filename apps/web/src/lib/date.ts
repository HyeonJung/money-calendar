export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function monthGrid(date: Date) {
  const first = startOfMonth(date);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

export function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toInputDate(date: Date) {
  return dateKey(date);
}

export function toInclusiveAllDayEndDate(value: string) {
  return toInputDate(addDays(new Date(value), -1));
}

export function isAllDayDateRangeValid(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && endDate >= startDate);
}

export function toKoreanDate(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function isoAt(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00+09:00`).toISOString();
}

export function monthRange(date: Date) {
  const start = monthGrid(date)[0];
  const end = addDays(monthGrid(date)[41], 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function weekRange(date: Date) {
  const start = startOfWeek(date);
  const end = addDays(start, 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function dayRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = addDays(start, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
