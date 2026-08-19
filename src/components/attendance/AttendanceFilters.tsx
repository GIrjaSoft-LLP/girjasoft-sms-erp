"use client";

import {
  currentMonthIso,
  endOfWeekFromStart,
  formatDateLabel,
  formatMonthLabel,
  shiftMonth,
  shiftWeek,
  startOfWeekMonday,
  todayIso,
} from "@/lib/attendance/filters";
import type { AttendanceFilterState, LinkedChildItem, ScopeOptions } from "@/components/attendance/types";

type AttendanceFiltersProps = {
  role: "admin" | "teacher" | "parent" | "student";
  value: AttendanceFilterState;
  onChange: (next: AttendanceFilterState) => void;
  onReset: () => void;
  scopeOptions?: ScopeOptions;
  children?: LinkedChildItem[];
  hideScope?: boolean;
};

const FILTER_TYPES = [
  { id: "date", label: "Date Wise" },
  { id: "week", label: "Week Wise" },
  { id: "month", label: "Month Wise" },
] as const;

export function AttendanceFilters({
  role,
  value,
  onChange,
  onReset,
  scopeOptions,
  children,
  hideScope = false,
}: AttendanceFiltersProps) {
  const showScopeFilters = !hideScope && (role === "admin" || role === "teacher");
  const showChildSelector = !hideScope && role === "parent" && (children?.length ?? 0) > 1;

  const sectionOptions = scopeOptions?.sections.filter((row) => !value.classId || row.classId === value.classId) ?? [];
  const studentOptions =
    scopeOptions?.students.filter((row) => {
      if (value.academicSessionId && row.academicSessionId !== value.academicSessionId) return false;
      if (value.classId && row.classId !== value.classId) return false;
      if (value.sectionId && row.sectionId !== value.sectionId) return false;
      return true;
    }) ?? [];
  const subjectOptions =
    scopeOptions?.subjects.filter((row) => !value.classId || row.classId === value.classId) ?? [];

  function patch(partial: Partial<AttendanceFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="gs-card space-y-4 p-4">
      {showChildSelector ? (
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Select Child</span>
          <select
            className="gs-input w-full"
            value={value.studentId ?? ""}
            onChange={(e) => patch({ studentId: e.target.value })}
          >
            {children?.map((child) => (
              <option key={child._id} value={child._id}>
                {child.name} · {child.className}
                {child.sectionName ? `-${child.sectionName}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showScopeFilters && scopeOptions ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Academic Session</span>
            <select
              className="gs-input w-full"
              value={value.academicSessionId ?? ""}
              onChange={(e) => patch({ academicSessionId: e.target.value, studentId: "" })}
            >
              <option value="">All Sessions</option>
              {scopeOptions.academicSessions.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                  {row.isCurrent ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Class</span>
            <select
              className="gs-input w-full"
              value={value.classId ?? ""}
              onChange={(e) => patch({ classId: e.target.value, sectionId: "", studentId: "", subjectId: "" })}
            >
              <option value="">All Classes</option>
              {scopeOptions.classes.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Section</span>
            <select
              className="gs-input w-full"
              value={value.sectionId ?? ""}
              onChange={(e) => patch({ sectionId: e.target.value, studentId: "" })}
              disabled={!value.classId}
            >
              <option value="">All Sections</option>
              {sectionOptions.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Student</span>
            <select
              className="gs-input w-full"
              value={value.studentId ?? ""}
              onChange={(e) => patch({ studentId: e.target.value })}
            >
              <option value="">All Students</option>
              {studentOptions.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name} · {row.admissionNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Subject</span>
            <select
              className="gs-input w-full"
              value={value.subjectId ?? ""}
              onChange={(e) => patch({ subjectId: e.target.value })}
            >
              <option value="">All Subjects</option>
              {subjectOptions.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Filter Type</span>
          <select
            className="gs-input"
            value={value.filterType}
            onChange={(e) => {
              const filterType = e.target.value as AttendanceFilterState["filterType"];
              if (filterType === "date") {
                patch({ filterType, date: value.date ?? todayIso() });
              } else if (filterType === "week") {
                patch({ filterType, weekStart: value.weekStart ?? startOfWeekMonday() });
              } else {
                patch({ filterType, month: value.month ?? currentMonthIso() });
              }
            }}
          >
            {FILTER_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {value.filterType === "date" ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Select Date</span>
            <input
              className="gs-input"
              type="date"
              value={value.date ?? todayIso()}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
        ) : null}

        {value.filterType === "week" ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="text-sm">
              <span className="mb-1 block text-slate-600">Week</span>
              <p className="rounded-lg border px-3 py-2 text-[#0b1b3a]">
                {formatDateLabel(value.weekStart ?? startOfWeekMonday())} →{" "}
                {formatDateLabel(endOfWeekFromStart(value.weekStart ?? startOfWeekMonday()))}
              </p>
            </div>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ weekStart: shiftWeek(value.weekStart ?? startOfWeekMonday(), -1) })}
            >
              ← Previous Week
            </button>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ weekStart: startOfWeekMonday() })}
            >
              Current Week
            </button>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ weekStart: shiftWeek(value.weekStart ?? startOfWeekMonday(), 1) })}
            >
              Next Week →
            </button>
          </div>
        ) : null}

        {value.filterType === "month" ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="text-sm">
              <span className="mb-1 block text-slate-600">Select Month</span>
              <p className="rounded-lg border px-3 py-2 text-[#0b1b3a]">
                {formatMonthLabel(value.month ?? currentMonthIso())}
              </p>
            </div>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ month: shiftMonth(value.month ?? currentMonthIso(), -1) })}
            >
              ← Previous Month
            </button>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ month: currentMonthIso() })}
            >
              Current Month
            </button>
            <button
              type="button"
              className="gs-btn px-3 py-2 text-sm"
              onClick={() => patch({ month: shiftMonth(value.month ?? currentMonthIso(), 1) })}
            >
              Next Month →
            </button>
          </div>
        ) : null}

        <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={onReset}>
          Reset Filters
        </button>
      </div>
    </div>
  );
}

export function createDefaultFilterState(
  role: "admin" | "teacher" | "parent" | "student",
  options?: {
    academicSessionId?: string;
    studentId?: string;
  },
): AttendanceFilterState {
  return {
    filterType: "month",
    month: currentMonthIso(),
    academicSessionId: role === "admin" || role === "teacher" ? options?.academicSessionId ?? "" : "",
    classId: "",
    sectionId: "",
    studentId: options?.studentId ?? "",
    subjectId: "",
    date: todayIso(),
    weekStart: startOfWeekMonday(),
  };
}
