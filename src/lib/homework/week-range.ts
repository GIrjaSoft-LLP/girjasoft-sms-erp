const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  if (!ISO_DAY.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDays(isoDate: string, days: number) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  parsed.setDate(parsed.getDate() + days);
  return toIsoDate(parsed);
}

export function startOfWeekMonday(fromIso?: string) {
  const source = fromIso ? parseIsoDate(fromIso) : new Date();
  const local = source
    ? new Date(source.getFullYear(), source.getMonth(), source.getDate())
    : new Date();
  const weekday = local.getDay();
  const shift = weekday === 0 ? -6 : 1 - weekday;
  local.setDate(local.getDate() + shift);
  return toIsoDate(local);
}

export function weekEndFromStart(startIso: string) {
  return addDays(startIso, 6);
}

export function eachDayInclusive(startIso: string, endIso: string) {
  const days: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function formatWeekRangeLabel(startIso: string, endIso: string) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return `${startIso} - ${endIso}`;
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${start.toLocaleDateString("en-IN", opts)} - ${end.toLocaleDateString("en-IN", opts)}`;
}

export function formatWeekdayLabel(isoDate: string) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString("en-IN", { weekday: "long" });
}

export function formatDayLabel(isoDate: string) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function resolveHomeworkWeekRange(startDate?: string | null, endDate?: string | null) {
  const start = startDate && parseIsoDate(startDate) ? startDate : startOfWeekMonday();
  const requestedEnd = endDate && parseIsoDate(endDate) ? endDate : weekEndFromStart(start);
  const maxEnd = weekEndFromStart(start);
  const end = requestedEnd < start ? maxEnd : requestedEnd > maxEnd ? maxEnd : requestedEnd;
  return { startDate: start, endDate: end };
}
