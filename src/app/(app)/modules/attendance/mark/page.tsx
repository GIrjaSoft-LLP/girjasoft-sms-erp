"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUSES,
  type AttendanceSettings,
  type AttendanceStatus,
  type AttendanceType,
} from "@/config/attendance";
import { api } from "@/lib/client";
import { StudentPhotoAvatar } from "@/components/attendance/StudentPhotoAvatar";

type ScopePayload = {
  allAccess: boolean;
  classTeacher: Array<{ classId: string; sectionId: string; className: string; sectionName: string; label: string }>;
  subjectTeacher: Array<{ classId: string; sectionId: string; subjectId: string; className: string; sectionName: string; subjectName: string; label: string }>;
};

type OptionsPayload = {
  allAccess: boolean;
  settings: AttendanceSettings;
  scopes: ScopePayload;
  classes: Array<{ _id: string; name: string }>;
  sections: Array<{ _id: string; name: string; classId: string }>;
  subjects: Array<{ _id: string; name: string; code?: string; classId: string }>;
};

type RosterStudent = {
  _id: string;
  serial: number;
  name: string;
  admissionNumber: string;
  status: AttendanceStatus;
  remarks: string;
};

function countSummary(students: RosterStudent[]) {
  return {
    total: students.length,
    present: students.filter((row) => row.status === "PRESENT").length,
    absent: students.filter((row) => row.status === "ABSENT").length,
    late: students.filter((row) => row.status === "LATE").length,
    leave: students.filter((row) => row.status === "LEAVE").length,
  };
}

export default function MarkAttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("CLASS");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [options, setOptions] = useState<OptionsPayload | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [locked, setLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [allowEdit, setAllowEdit] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<OptionsPayload>("/api/attendance/roster?mode=options"),
      api<{ user?: { teacherContextClassId?: string; teacherContextSectionId?: string; teacherContextSubjectId?: string } }>(
        "/api/auth/me",
      ).catch(() => ({ user: undefined })),
    ])
      .then(([optionData, meRes]) => {
        setOptions(optionData);
        const params = new URLSearchParams(window.location.search);
        const queryClassId = params.get("classId");
        const querySectionId = params.get("sectionId");
        if (queryClassId && querySectionId) {
          setClassId(queryClassId);
          setSectionId(querySectionId);
          return;
        }
        if (meRes.user?.teacherContextClassId && meRes.user?.teacherContextSectionId) {
          setClassId(meRes.user.teacherContextClassId);
          setSectionId(meRes.user.teacherContextSectionId);
          if (meRes.user.teacherContextSubjectId && optionData.settings.enableSubjectAttendance) {
            setAttendanceType("SUBJECT");
            setSubjectId(meRes.user.teacherContextSubjectId);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load attendance options"))
      .finally(() => setLoadingOptions(false));
  }, []);

  const classOptions = options?.classes ?? [];

  const sectionOptions = useMemo(() => {
    if (!options) return [];
    return options.sections.filter((item) => item.classId === classId);
  }, [classId, options]);

  const subjectOptions = useMemo(() => {
    if (!options || !classId || !sectionId) return [];
    return options.subjects.filter((item) => item.classId === classId);
  }, [classId, options, sectionId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.admissionNumber.toLowerCase().includes(q),
    );
  }, [studentSearch, students]);

  const summary = useMemo(() => countSummary(students), [students]);

  const selectedClassName = classOptions.find((row) => row._id === classId)?.name ?? "";
  const selectedSectionName = sectionOptions.find((row) => row._id === sectionId)?.name ?? "";
  const selectedSubjectName = subjectOptions.find((row) => row._id === subjectId)?.name ?? "";

  async function loadStudents() {
    setError("");
    setMessage("");
    if (!classId || !sectionId) {
      setError("Select class and section.");
      return;
    }
    if (attendanceType === "SUBJECT" && !subjectId) {
      setError("Select subject for subject attendance.");
      return;
    }
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams({
        date,
        classId,
        sectionId,
        attendanceType,
      });
      if (subjectId) params.set("subjectId", subjectId);
      const data = await api<{
        students: RosterStudent[];
        locked: boolean;
        submitted?: boolean;
        allowEdit?: boolean;
      }>(`/api/attendance/roster?${params}`);
      setStudents(data.students);
      setLocked(data.locked);
      setSubmitted(Boolean(data.submitted));
      setAllowEdit(data.allowEdit ?? !data.locked);
      if (!data.students.length) {
        setMessage("No students found for this class and section.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  function setAll(status: AttendanceStatus) {
    setStudents((rows) => rows.map((row) => ({ ...row, status })));
  }

  function updateStudent(id: string, patch: Partial<RosterStudent>) {
    setStudents((rows) => rows.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  }

  async function save(submit = true) {
    if (!students.length) {
      setError("Load students before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message?: string }>("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          date,
          classId,
          sectionId,
          attendanceType,
          subjectId: attendanceType === "SUBJECT" ? subjectId : null,
          submit,
          records: students.map((row) => ({
            studentId: row._id,
            status: row.status,
            remarks: row.remarks,
          })),
        }),
      });
      const label = selectedClassName
        ? `${selectedClassName}${selectedSectionName ? ` - ${selectedSectionName}` : ""}`
        : "selected class";
      setMessage(result.message ?? `Attendance saved successfully for ${label}.`);
      setLocked(submit);
      setSubmitted(submit);
      setAllowEdit(!submit || Boolean(options?.settings.allowTeacherEdit));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loadingOptions) {
    return <p className="text-sm text-slate-500">Loading attendance options…</p>;
  }

  if (!options) {
    return <p className="text-sm text-red-600">{error || "Unable to load attendance options."}</p>;
  }

  if (!options.allAccess && !classOptions.length) {
    return (
      <div className="gs-card p-6 text-sm text-slate-600">
        <p className="font-semibold text-[#0b1b3a]">No classes have been assigned to you.</p>
        <p className="mt-2">Please contact your administrator to assign classes under Settings → Teacher Assignment.</p>
      </div>
    );
  }

  const canEdit = !locked || allowEdit;
  const showSubjectField = options.settings.enableSubjectAttendance && attendanceType === "SUBJECT";

  return (
    <div className="space-y-4">
      <div className="gs-card grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Class</span>
          <select
            className="gs-input"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
              setSubjectId("");
              setStudents([]);
              setMessage("");
            }}
          >
            <option value="">Select Class</option>
            {classOptions.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Section</span>
          <select
            className="gs-input"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setSubjectId("");
              setStudents([]);
              setMessage("");
            }}
            disabled={!classId}
          >
            <option value="">Select Section</option>
            {sectionOptions.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Date</span>
          <input className="gs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {showSubjectField ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Subject</span>
            <select
              className="gs-input"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setStudents([]);
              }}
              disabled={!sectionId}
            >
              <option value="">Select Subject</option>
              {subjectOptions.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {options.settings.enableClassAttendance && options.settings.enableSubjectAttendance ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Attendance Type</span>
            <select
              className="gs-input"
              value={attendanceType}
              onChange={(e) => {
                setAttendanceType(e.target.value as AttendanceType);
                setSubjectId("");
                setStudents([]);
              }}
            >
              <option value="CLASS">Class Attendance</option>
              <option value="SUBJECT">Subject Attendance</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="gs-btn px-4 py-2"
          disabled={loadingStudents || !classId || !sectionId}
          onClick={() => void loadStudents()}
        >
          {loadingStudents ? "Loading…" : "Load Students"}
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAll("PRESENT")} disabled={!students.length || !canEdit}>
          Mark All Present
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAll("ABSENT")} disabled={!students.length || !canEdit}>
          Mark All Absent
        </button>
        <button type="button" className="gs-btn px-4 py-2" disabled={!students.length || !canEdit || saving} onClick={() => void save(true)}>
          {saving ? "Saving…" : submitted && canEdit ? "Update Attendance" : "Save Attendance"}
        </button>
      </div>

      {submitted && locked ? (
        <div className="gs-card p-4 text-sm text-amber-800">
          <p>Attendance already submitted for this class, section and date.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/modules/attendance" className="text-[#4c7eff] hover:underline">
              View Attendance
            </Link>
            {allowEdit ? (
              <button
                type="button"
                className="text-[#4c7eff] hover:underline"
                onClick={() => {
                  setLocked(false);
                  setAllowEdit(true);
                }}
              >
                Edit Attendance
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {students.length ? (
        <div className="gs-card p-4 text-sm">
          <p className="font-semibold">Summary</p>
          <p className="mt-2 text-slate-600">
            Total Students: {summary.total} · Present: {summary.present} · Absent: {summary.absent} · Late:{" "}
            {summary.late} · Leave: {summary.leave}
          </p>
          {selectedClassName ? (
            <p className="mt-1 text-slate-500">
              {selectedClassName}
              {selectedSectionName ? ` - ${selectedSectionName}` : ""}
              {selectedSubjectName ? ` · ${selectedSubjectName}` : ""} · {date}
            </p>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {students.length ? (
        <>
          <label className="block max-w-sm text-sm">
            Search Student
            <input
              className="gs-input mt-1"
              placeholder="Search by name or admission number"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
          </label>
          <div className="gs-card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-3">#</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Admission No.</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Remark</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="border-b">
                    <td className="p-3">{student.serial}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <StudentPhotoAvatar studentId={student._id} name={student.name} />
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td className="p-3">{student.admissionNumber}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={!canEdit}
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              student.status === status
                                ? status === "PRESENT"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                                : "border border-slate-200 text-slate-500"
                            }`}
                            onClick={() => updateStudent(student._id, { status })}
                          >
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </button>
                        ))}
                        <select
                          className="gs-input min-w-[7rem]"
                          value={student.status}
                          disabled={!canEdit}
                          onChange={(e) => updateStudent(student._id, { status: e.target.value as AttendanceStatus })}
                        >
                          {ATTENDANCE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {ATTENDANCE_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-3">
                      <input
                        className="gs-input"
                        value={student.remarks}
                        disabled={!canEdit}
                        onChange={(e) => updateStudent(student._id, { remarks: e.target.value })}
                        placeholder="Optional remark"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
