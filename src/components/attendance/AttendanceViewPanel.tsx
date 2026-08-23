"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttendanceFilters, createDefaultFilterState } from "@/components/attendance/AttendanceFilters";
import { AttendanceRecordsTable } from "@/components/attendance/AttendanceRecordsTable";
import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";
import { SubjectAttendanceList } from "@/components/attendance/SubjectAttendanceList";
import {
  filterStateToParams,
  type AttendanceFilterState,
  type AttendanceViewPayload,
} from "@/components/attendance/types";
import { api } from "@/lib/client";

type AttendanceViewPanelProps = {
  mode?: "view" | "student";
  studentId?: string;
  onStudentChange?: (studentId: string) => void;
};

export function AttendanceViewPanel({ mode = "view", studentId, onStudentChange }: AttendanceViewPanelProps) {
  const [data, setData] = useState<AttendanceViewPayload | null>(null);
  const [filters, setFilters] = useState<AttendanceFilterState>(() =>
    createDefaultFilterState("admin", { studentId }),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initializedRef = useRef(false);

  const role = data?.role ?? (mode === "student" ? "student" : "admin");
  const showStudentColumns = (role === "admin" || role === "teacher") && !filters.studentId && !studentId;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filterStateToParams({
        ...filters,
        studentId: studentId ?? filters.studentId,
      });
      const endpoint =
        mode === "student" && studentId
          ? `/api/attendance/students/${studentId}?${params}`
          : `/api/attendance/view?${params}`;
      const payload = await api<AttendanceViewPayload & { recent?: AttendanceViewPayload["records"] }>(endpoint);
      const normalized: AttendanceViewPayload = {
        ...payload,
        records: payload.records ?? payload.recent ?? [],
      };
      setData(normalized);

      if (!initializedRef.current && !studentId && normalized.defaults) {
        initializedRef.current = true;
        setFilters((current) => ({
          ...current,
          academicSessionId: normalized.defaults?.academicSessionId ?? current.academicSessionId,
          studentId:
            normalized.role === "parent"
              ? normalized.activeStudentId ?? current.studentId
              : current.studentId,
        }));
      } else if (!initializedRef.current && normalized.role === "parent" && normalized.activeStudentId) {
        initializedRef.current = true;
        setFilters((current) => ({ ...current, studentId: normalized.activeStudentId ?? current.studentId }));
      } else {
        initializedRef.current = true;
      }
    } catch (err: unknown) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [filters, mode, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (studentId) {
      setFilters((current) => ({ ...current, studentId }));
    }
  }, [studentId]);

  const resetFilters = useCallback(() => {
    const currentSession =
      data?.scopeOptions?.academicSessions.find((row) => row.isCurrent)?._id ??
      data?.defaults?.academicSessionId ??
      "";
    const next = createDefaultFilterState(role, {
      academicSessionId: currentSession,
      studentId:
        studentId ??
        (role === "parent" ? data?.activeStudentId ?? data?.children?.[0]?._id ?? "" : ""),
    });
    setFilters(next);
  }, [data, role, studentId]);

  const handleFilterChange = useCallback(
    (next: AttendanceFilterState) => {
      setFilters(next);
      if (role === "parent" && next.studentId && next.studentId !== filters.studentId) {
        onStudentChange?.(next.studentId);
      }
    },
    [filters.studentId, onStudentChange, role],
  );

  const hasRecords = useMemo(() => {
    if (!data) return false;
    return (
      data.classSummary.workingDays > 0 ||
      data.records.length > 0 ||
      data.dailyBreakdown.length > 0 ||
      data.subjectWise.length > 0
    );
  }, [data]);

  if (loading && !data) {
    return <div className="gs-card p-4 text-sm text-slate-500">Loading attendance…</div>;
  }

  if (error && !data) {
    return (
      <div className="gs-card space-y-2 p-4 text-sm">
        <p className="font-medium text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AttendanceFilters
        role={role}
        value={filters}
        onChange={studentId && mode !== "view" ? setFilters : handleFilterChange}
        onReset={resetFilters}
        scopeOptions={data?.scopeOptions}
        children={data?.children}
        hideScope={Boolean(studentId)}
      />

      {data?.student ? (
        <div className="gs-card p-4 text-sm text-slate-600">
          <span className="font-medium text-[#0b1b3a]">{data.student.name}</span>
          {data.student.admissionNumber ? ` · ${data.student.admissionNumber}` : ""}
          {data.student.className ? (
            <span>
              {" "}
              · {data.student.className}
              {data.student.sectionName ? `-${data.student.sectionName}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-slate-500">Updating attendance…</div> : null}

      {!hasRecords ? (
        <div className="gs-card p-4 text-sm text-slate-500">No attendance records for the selected period.</div>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <AttendanceSummary summary={data.classSummary} />
            <SubjectAttendanceList items={data.subjectWise} />
          </div>
          <AttendanceRecordsTable
            filterType={data.filter.filterType}
            records={data.records}
            dailyBreakdown={data.dailyBreakdown}
            showStudentColumns={showStudentColumns}
            title={role === "teacher" ? "Attendance History" : "Attendance Records"}
          />
        </>
      ) : null}
    </div>
  );
}
