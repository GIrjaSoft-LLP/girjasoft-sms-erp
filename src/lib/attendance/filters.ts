export type AttendanceFilterType = "date" | "week" | "month";

export type AttendanceFilterInput = {
  filterType?: AttendanceFilterType;
  date?: string;
  weekStart?: string;
  month?: string;
};

export type ResolvedAttendanceFilter = {
  filterType: AttendanceFilterType;
  from: string;
  to: string;
  label: string;
  date?: string;
  weekStart?: string;
  month?: string;
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthIso() {
  return todayIso().slice(0, 7);
}

export function defaultAttendanceFilter(): ResolvedAttendanceFilter {
  return resolveAttendanceFilter({ filterType: "month", month: currentMonthIso() });
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return isoDate(d);
}

export function endOfWeekFromStart(weekStart: string) {
  const d = parseIsoDate(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  return isoDate(d);
}

export function monthBounds(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateLabel(date: string) {
  return parseIsoDate(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shiftWeek(weekStart: string, delta: number) {
  const d = parseIsoDate(weekStart);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return isoDate(d);
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNum] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function resolveAttendanceFilter(input: AttendanceFilterInput = {}): ResolvedAttendanceFilter {
  const filterType = input.filterType ?? "month";

  if (filterType === "date") {
    const date = input.date ?? todayIso();
    return {
      filterType,
      from: date,
      to: date,
      label: formatDateLabel(date),
      date,
    };
  }

  if (filterType === "week") {
    const weekStart = input.weekStart ?? startOfWeekMonday();
    const weekEnd = endOfWeekFromStart(weekStart);
    return {
      filterType,
      from: weekStart,
      to: weekEnd,
      label: `${formatDateLabel(weekStart)} → ${formatDateLabel(weekEnd)}`,
      weekStart,
    };
  }

  const month = input.month ?? currentMonthIso();
  const { from, to } = monthBounds(month);
  return {
    filterType,
    from,
    to,
    label: formatMonthLabel(month),
    month,
  };
}

export function buildAttendanceFilterQuery(input: AttendanceFilterInput) {
  const filter = resolveAttendanceFilter(input);
  const params = new URLSearchParams();
  params.set("filterType", filter.filterType);
  if (filter.date) params.set("date", filter.date);
  if (filter.weekStart) params.set("weekStart", filter.weekStart);
  if (filter.month) params.set("month", filter.month);
  return { filter, params };
}
