"use client";

import { useEffect, useMemo, useState } from "react";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUSES, type AttendanceStatus, type AttendanceType } from "@/config/attendance";
import { api } from "@/lib/client";

type ScopePayload = {
  allAccess: boolean;
  classTeacher: Array<{ classId: string; sectionId: string; className: string; sectionName: string; label: string }>;
  subjectTeacher: Array<{ classId: string; sectionId: string; subjectId: string; className: string; sectionName: string; subjectName: string; label: string }>;
};

type RosterStudent = {
  _id: string;
  serial: number;
  name: string;
  admissionNumber: string;
  status: AttendanceStatus;
  remarks: string;
};

export default function MarkAttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("CLASS");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [scopes, setScopes] = useState<ScopePayload | null>(null);
  const [classes, setClasses] = useState<Array<{ _id: string; name: string }>>([]);
  const [sections, setSections] = useState<Array<{ _id: string; name: string; classId: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<ScopePayload>("/api/attendance/roster?mode=scopes"),
      api<{ items: Array<{ _id: string; name: string }> }>("/api/classes"),
      api<{ items: Array<{ _id: string; name: string; classId: string }> }>("/api/sections"),
    ]).then(([scopeData, classData, sectionData]) => {
      setScopes(scopeData);
      setClasses(classData.items);
      setSections(sectionData.items);
    });
  }, []);

  const classOptions = useMemo(() => {
    if (!scopes) return [];
    if (scopes.allAccess) return classes;
    const allowedClassIds = new Set([
      ...scopes.classTeacher.map((item) => item.classId),
      ...scopes.subjectTeacher.map((item) => item.classId),
    ]);
    return classes.filter((item) => allowedClassIds.has(item._id));
  }, [classes, scopes]);

  const sectionOptions = useMemo(() => {
    const filtered = sections.filter((item) => item.classId === classId);
    if (!scopes || scopes.allAccess) return filtered;
    const allowed = new Set(
      (attendanceType === "CLASS" ? scopes.classTeacher : scopes.subjectTeacher)
        .filter((item) => item.classId === classId)
        .map((item) => item.sectionId),
    );
    return filtered.filter((item) => allowed.has(item._id));
  }, [attendanceType, classId, scopes, sections]);

  useEffect(() => {
    if (!classId || !sectionId) {
      setSubjects([]);
      return;
    }
    api<{ subjects: Array<{ _id: string; name: string }> }>(
      `/api/attendance/roster?mode=subjects&classId=${classId}&sectionId=${sectionId}`,
    )
      .then((data) => setSubjects(data.subjects))
      .catch(() => setSubjects([]));
  }, [classId, sectionId]);

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
    const params = new URLSearchParams({
      date,
      classId,
      sectionId,
      attendanceType,
    });
    if (subjectId) params.set("subjectId", subjectId);
    const data = await api<{ students: RosterStudent[]; locked: boolean }>(`/api/attendance/roster?${params}`);
    setStudents(data.students);
    setLocked(data.locked);
  }

  function setAll(status: AttendanceStatus) {
    setStudents((rows) => rows.map((row) => ({ ...row, status })));
  }

  function updateStudent(id: string, patch: Partial<RosterStudent>) {
    setStudents((rows) => rows.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  }

  async function save(submit = true) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/attendance/mark", {
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
      setMessage(submit ? "Attendance saved and submitted." : "Attendance draft saved.");
      setLocked(submit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="gs-card grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Date</span>
          <input className="gs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Attendance Type</span>
          <select
            className="gs-input"
            value={attendanceType}
            onChange={(e) => {
              setAttendanceType(e.target.value as AttendanceType);
              setSubjectId("");
            }}
          >
            <option value="CLASS">Class Attendance</option>
            <option value="SUBJECT">Subject Attendance</option>
          </select>
        </label>
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
            }}
          >
            <option value="">Select Section</option>
            {sectionOptions.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {attendanceType === "SUBJECT" ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Subject</span>
            <select className="gs-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select Subject</option>
              {subjects.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="gs-btn px-4 py-2" onClick={() => void loadStudents().catch((err) => setError(err.message))}>
          Load Students
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAll("PRESENT")} disabled={!students.length || locked}>
          Mark All Present
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAll("ABSENT")} disabled={!students.length || locked}>
          Mark All Absent
        </button>
        <button type="button" className="gs-btn px-4 py-2" disabled={!students.length || locked || saving} onClick={() => void save(true)}>
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {locked ? <p className="text-sm text-amber-700">Attendance is submitted for this class/section/date.</p> : null}

      {students.length ? (
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
              {students.map((student) => (
                <tr key={student._id} className="border-b">
                  <td className="p-3">{student.serial}</td>
                  <td className="p-3">{student.name}</td>
                  <td className="p-3">{student.admissionNumber}</td>
                  <td className="p-3">
                    <select
                      className="gs-input"
                      value={student.status}
                      disabled={locked}
                      onChange={(e) => updateStudent(student._id, { status: e.target.value as AttendanceStatus })}
                    >
                      {ATTENDANCE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ATTENDANCE_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      className="gs-input"
                      value={student.remarks}
                      disabled={locked}
                      onChange={(e) => updateStudent(student._id, { remarks: e.target.value })}
                      placeholder="Optional remark"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
