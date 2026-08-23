"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type Assignment = {
  kind: "CLASS" | "SUBJECT";
  classId: string;
  sectionId: string;
  subjectId?: string;
  className: string;
  sectionName: string;
  subjectName?: string;
  label: string;
};

type ContextPayload = {
  assignments: Assignment[];
  previousContext?: {
    classId: string;
    sectionId: string;
    subjectId?: string;
    className: string;
    sectionName: string;
    subjectName?: string;
    date: string;
  } | null;
  todaySchedule: Array<{
    period: string;
    classId: string;
    sectionId: string;
    subjectId: string;
    className: string;
    sectionName: string;
    subjectName: string;
  }>;
  teacherName: string;
};

function normId(value: unknown) {
  return String(value ?? "").trim();
}

function classSectionKey(classId: unknown, sectionId: unknown) {
  return `${normId(classId)}:${normId(sectionId)}`;
}

export function TeacherContextDialog({
  onComplete,
}: {
  onComplete: (context: {
    classId: string;
    sectionId: string;
    subjectId?: string | null;
    className?: string;
    sectionName?: string;
    subjectName?: string;
  }) => void | Promise<void>;
}) {
  const [data, setData] = useState<ContextPayload | null>(null);
  const [mode, setMode] = useState<"welcome" | "select">("welcome");
  const [classSectionKeyValue, setClassSectionKeyValue] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api<ContextPayload>("/api/teacher/context");
      setData(payload);

      const previousAllowed =
        payload.previousContext &&
        payload.assignments.some(
          (item) =>
            item.classId === payload.previousContext!.classId &&
            item.sectionId === payload.previousContext!.sectionId &&
            (!payload.previousContext!.subjectId ||
              item.subjectId === payload.previousContext!.subjectId ||
              item.kind === "CLASS"),
        );

      if (!previousAllowed) {
        setMode("select");
      }

      if (payload.assignments.length === 1) {
        const only = payload.assignments[0];
        setClassSectionKeyValue(classSectionKey(only.classId, only.sectionId));
        setSubjectId(only.subjectId ?? "");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const classSectionOptions = useMemo(() => {
    const map = new Map<string, { classId: string; sectionId: string; label: string }>();
    for (const item of data?.assignments ?? []) {
      const key = classSectionKey(item.classId, item.sectionId);
      if (!map.has(key)) {
        const label = `${item.className} - ${item.sectionName}`.replace(/\s+-\s+$/, "").trim();
        map.set(key, {
          classId: normId(item.classId),
          sectionId: normId(item.sectionId),
          label: label || key,
        });
      }
    }
    for (const slot of data?.todaySchedule ?? []) {
      const key = classSectionKey(slot.classId, slot.sectionId);
      if (!map.has(key)) {
        const label = `${slot.className} - ${slot.sectionName}`.replace(/\s+-\s+$/, "").trim();
        map.set(key, {
          classId: normId(slot.classId),
          sectionId: normId(slot.sectionId),
          label: label || key,
        });
      }
    }
    return [...map.values()];
  }, [data]);

  const selectedClassSection = useMemo(
    () => classSectionOptions.find((row) => classSectionKey(row.classId, row.sectionId) === classSectionKeyValue),
    [classSectionKeyValue, classSectionOptions],
  );

  const subjectOptions = useMemo(() => {
    if (!selectedClassSection) return [];
    return (data?.assignments ?? []).filter(
      (item) =>
        normId(item.classId) === selectedClassSection.classId &&
        normId(item.sectionId) === selectedClassSection.sectionId &&
        item.subjectId,
    );
  }, [data, selectedClassSection]);

  const hasClassTeacherRole = useMemo(() => {
    if (!selectedClassSection) return false;
    return (data?.assignments ?? []).some(
      (item) =>
        item.kind === "CLASS" &&
        normId(item.classId) === selectedClassSection.classId &&
        normId(item.sectionId) === selectedClassSection.sectionId,
    );
  }, [data, selectedClassSection]);

  useEffect(() => {
    if (!selectedClassSection) {
      setSubjectId("");
      return;
    }
    if (subjectOptions.length === 1) {
      const only = normId(subjectOptions[0].subjectId);
      setSubjectId((current) => (current === only ? current : only));
      return;
    }
    setSubjectId((current) =>
      subjectOptions.some((item) => normId(item.subjectId) === current) ? current : "",
    );
  }, [selectedClassSection, subjectOptions]);

  const resolvedSubjectId = useMemo(() => {
    if (subjectId) return subjectId;
    if (subjectOptions.length === 1) return normId(subjectOptions[0].subjectId);
    return "";
  }, [subjectId, subjectOptions]);

  const canContinue = Boolean(
    selectedClassSection &&
      (subjectOptions.length === 0 || subjectOptions.length === 1 || Boolean(resolvedSubjectId)),
  );

  const todaySuggestion = useMemo(() => {
    if (!data?.todaySchedule.length || !selectedClassSection) return null;
    return (
      data.todaySchedule.find(
        (slot) =>
          slot.classId === selectedClassSection.classId && slot.sectionId === selectedClassSection.sectionId,
      ) ?? data.todaySchedule[0]
    );
  }, [data, selectedClassSection]);

  async function submit(context: { classId: string; sectionId: string; subjectId?: string }) {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        classId: normId(context.classId),
        sectionId: normId(context.sectionId),
      };
      const subject = normId(context.subjectId);
      if (subject) payload.subjectId = subject;

      const result = await api<{
        ok: boolean;
        context: {
          classId: string;
          sectionId: string;
          subjectId?: string | null;
          className?: string;
          sectionName?: string;
          subjectName?: string;
        };
      }>("/api/auth/teacher-context", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await onComplete(result.context);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to set today's class. Please try again or contact your administrator.",
      );
    } finally {
      setSaving(false);
    }
  }

  function applyScheduleSlot(slot: ContextPayload["todaySchedule"][number]) {
    setClassSectionKeyValue(classSectionKey(slot.classId, slot.sectionId));
    setSubjectId(normId(slot.subjectId));
    setError("");
  }

  function handleContinue() {
    if (!selectedClassSection) {
      setError("Please select a class / section to continue.");
      return;
    }
    if (subjectOptions.length >= 1 && !resolvedSubjectId) {
      setError("Please select a subject to continue.");
      return;
    }
    void submit({
      classId: selectedClassSection.classId,
      sectionId: selectedClassSection.sectionId,
      subjectId: resolvedSubjectId,
    });
  }

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="gs-card w-full max-w-lg p-6 text-sm text-slate-500">Loading your classes…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="gs-card w-full max-w-lg space-y-4 p-6">
          <p className="text-sm text-red-600">{error || "Unable to load your classes."}</p>
          <button type="button" className="gs-btn px-4 py-2" onClick={() => void load()}>
            Refresh Assignments
          </button>
        </div>
      </div>
    );
  }

  const previousAllowed =
    data.previousContext &&
    data.assignments.some(
      (item) =>
        item.classId === data.previousContext!.classId &&
        item.sectionId === data.previousContext!.sectionId &&
        (!data.previousContext!.subjectId ||
          item.subjectId === data.previousContext!.subjectId ||
          item.kind === "CLASS"),
    );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="gs-card w-full max-w-lg space-y-4 p-6">
        <div>
          <h2 className="text-xl font-semibold text-[#0b1b3a]">Welcome, {data.teacherName}</h2>
          <p className="text-sm text-slate-500">Which class are you managing today?</p>
        </div>

        {!data.assignments.length ? (
          <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-slate-700">
            <p>No classes have been assigned to your Teacher account.</p>
            <p>
              Please contact your School Administrator to assign a Class / Section / Subject from Settings →
              Sections (Class Teacher) or Timetable (Subject Teacher).
            </p>
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => void load()}>
              Refresh Assignments
            </button>
          </div>
        ) : mode === "welcome" && previousAllowed && data.previousContext ? (
          <div className="space-y-3 rounded-lg border bg-slate-50 p-4 text-sm">
            <p>Your previous class was:</p>
            <p className="font-medium text-[#0b1b3a]">
              {data.previousContext.className} - {data.previousContext.sectionName}
              {data.previousContext.subjectName ? ` · ${data.previousContext.subjectName}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="gs-btn px-4 py-2"
                disabled={saving}
                onClick={() =>
                  void submit({
                    classId: data.previousContext!.classId,
                    sectionId: data.previousContext!.sectionId,
                    subjectId: data.previousContext!.subjectId,
                  })
                }
              >
                Continue Previous Class
              </button>
              <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setMode("select")}>
                Select Another Class
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Class / Section</span>
              <select
                className="gs-input w-full"
                value={classSectionKeyValue}
                onChange={(e) => {
                  setClassSectionKeyValue(e.target.value);
                  setSubjectId("");
                }}
              >
                <option value="">Choose class / section</option>
                {classSectionOptions.map((row) => (
                  <option key={classSectionKey(row.classId, row.sectionId)} value={classSectionKey(row.classId, row.sectionId)}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>

            {subjectOptions.length > 1 ? (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Subject</span>
                <select className="gs-input w-full" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Select subject</option>
                  {subjectOptions.map((row) => (
                    <option key={normId(row.subjectId)} value={normId(row.subjectId)}>
                      {row.subjectName}
                    </option>
                  ))}
                </select>
              </label>
            ) : resolvedSubjectId && subjectOptions.length === 1 ? (
              <p className="text-sm text-slate-600">
                Subject: <span className="font-medium text-[#0b1b3a]">{subjectOptions[0].subjectName}</span>
              </p>
            ) : hasClassTeacherRole && !subjectOptions.length ? (
              <p className="text-sm text-slate-600">Class teacher access for this section.</p>
            ) : null}

            {data.todaySchedule.length ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Today&apos;s Schedule</p>
                <ul className="mt-2 space-y-1 text-slate-600">
                  {data.todaySchedule.map((slot) => (
                    <li key={`${slot.period}-${slot.classId}-${slot.sectionId}-${slot.subjectId}`}>
                      <button
                        type="button"
                        className="w-full rounded px-1 py-1 text-left hover:bg-slate-100"
                        onClick={() => applyScheduleSlot(slot)}
                      >
                        {slot.period}: {slot.className} - {slot.sectionName}
                        {slot.subjectName ? ` · ${slot.subjectName}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
                {todaySuggestion ? (
                  <button
                    type="button"
                    className="mt-3 text-[#4c7eff] underline"
                    onClick={() => applyScheduleSlot(todaySuggestion)}
                  >
                    Use suggested: {todaySuggestion.className} - {todaySuggestion.sectionName}
                    {todaySuggestion.subjectName ? ` · ${todaySuggestion.subjectName}` : ""}
                  </button>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="gs-btn w-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || !canContinue}
              onClick={handleContinue}
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
