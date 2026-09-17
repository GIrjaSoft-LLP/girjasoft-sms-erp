"use client";

import {
  addDays,
  eachDayInclusive,
  formatDayLabel,
  formatWeekRangeLabel,
  formatWeekdayLabel,
  weekEndFromStart,
} from "@/lib/homework/week-range";

type HomeworkRow = {
  _id: string;
  subjectName?: string;
  title?: string;
  dueDate?: string;
};

export function ParentHomeworkWeek({
  startDate,
  items,
  loading,
  error,
  onPrev,
  onNext,
  onView,
}: {
  startDate: string;
  items: HomeworkRow[];
  loading: boolean;
  error: string;
  onPrev: () => void;
  onNext: () => void;
  onView: (id: string) => void;
}) {
  const endDate = weekEndFromStart(startDate);
  const days = eachDayInclusive(startDate, endDate);
  const byDate = new Map<string, HomeworkRow[]>();
  for (const item of items) {
    const due = String(item.dueDate ?? "").slice(0, 10);
    if (!due) continue;
    const list = byDate.get(due) ?? [];
    list.push(item);
    byDate.set(due, list);
  }
  const emptyWeek = !loading && !items.length;

  return (
    <div className="space-y-4">
      <div className="gs-card p-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={onPrev}>
            ← Previous 7 Days
          </button>
          <p className="text-center text-base font-semibold gs-heading">{formatWeekRangeLabel(startDate, endDate)}</p>
          <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab sm:text-right" onClick={onNext}>
            Next 7 Days →
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {emptyWeek ? (
        <div className="gs-card p-5 text-center text-sm gs-muted">
          <p className="font-medium text-[#0b1b3a]">No homework assigned for these 7 days.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {days.map((iso) => {
          const rows = byDate.get(iso) ?? [];
          return (
            <section key={iso} className="gs-card p-4">
              <h2 className="mb-3 text-sm font-semibold gs-heading">
                {formatWeekdayLabel(iso)}
                <span className="ml-2 font-normal gs-muted">{formatDayLabel(iso)}</span>
              </h2>
              {loading ? (
                <p className="text-sm gs-muted">Loading homework…</p>
              ) : rows.length ? (
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li key={row._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{row.title || "Homework"}</p>
                        {row.subjectName ? <p className="text-xs gs-muted">{row.subjectName}</p> : null}
                      </div>
                      <button type="button" className="text-[#4c7eff] hover:underline" onClick={() => onView(row._id)}>
                        View
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm gs-muted">No Homework</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function shiftWeek(startDate: string, direction: -1 | 1) {
  return addDays(startDate, direction * 7);
}
