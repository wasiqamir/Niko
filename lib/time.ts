export const TIME_ZONE = "Asia/Karachi";
export const TIME_ZONE_LABEL = "Pakistan time";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const WEEKDAYS = [
  { value: 1, label: "Mon", name: "Monday" },
  { value: 2, label: "Tue", name: "Tuesday" },
  { value: 3, label: "Wed", name: "Wednesday" },
  { value: 4, label: "Thu", name: "Thursday" },
  { value: 5, label: "Fri", name: "Friday" },
  { value: 6, label: "Sat", name: "Saturday" },
  { value: 0, label: "Sun", name: "Sunday" },
] as const;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday: WEEKDAY_INDEX[read("weekday")] ?? 0,
  };
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayKey(now = new Date()) {
  const parts = zonedParts(now);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
}

export function parseDateKey(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function addDays(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return dateKeyFromParts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function weekdayOfKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function zonedDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute, 0));
}

export function slotStart(key: string, hour: number) {
  const [year, month, day] = key.split("-").map(Number);
  return zonedDate(year, month, day, hour);
}

export function formatMinuteClock(date: Date) {
  const { hour, minute } = zonedParts(date);
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 || 12;
  return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatClock(hour: number) {
  if (hour === 24) return "12:00 AM";
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 || 12;
  return `${twelve}:00 ${suffix}`;
}

export function formatHourSpan(startHour: number, endHour: number) {
  return `${formatClock(startHour)}–${formatClock(endHour)}`;
}

export function formatRange(start: Date) {
  const { hour } = zonedParts(start);
  return `${formatClock(hour)}–${formatClock((hour + 1) % 24)}`;
}

export function formatDayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(zonedDate(year, month, day, 12));
}

export function formatMeetingWhen(start: Date) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start);
  return `${date}, ${formatRange(start)} (${TIME_ZONE_LABEL})`;
}
