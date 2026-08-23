"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/client";

export default function TeacherProfilePage() {
  const params = useParams<{ id: string }>();
  const [teacher, setTeacher] = useState<Record<string, unknown> | null>(null);
  const [assignments, setAssignments] = useState<Array<{ label: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      api<{ item: Record<string, unknown> }>(`/api/teachers/${params.id}`),
      api<{ assignments: Array<{ label: string }> }>(`/api/teacher/assignments?teacherId=${params.id}`),
    ])
      .then(([teacherRes, assignmentRes]) => {
        setTeacher(teacherRes.item);
        setAssignments(assignmentRes.assignments ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load teacher profile."));
  }, [params.id]);

  if (error) return <div className="gs-card p-4 text-sm text-red-600">{error}</div>;
  if (!teacher) return <div className="gs-card p-4 text-sm text-slate-500">Loading teacher profile…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{String(teacher.name ?? "Teacher")}</h2>
        {teacher.staffId ? (
          <Link href="/settings/staff" className="text-sm text-[#4c7eff] hover:underline">
            Edit in Settings → Staff
          </Link>
        ) : null}
      </div>
      <div className="gs-card grid gap-3 p-4 text-sm md:grid-cols-2">
        <div><span className="text-slate-500">Employee ID</span><p>{String(teacher.employeeId ?? "—")}</p></div>
        <div><span className="text-slate-500">Email</span><p>{String(teacher.email ?? "—")}</p></div>
        <div><span className="text-slate-500">Phone</span><p>{String(teacher.phone ?? "—")}</p></div>
        <div><span className="text-slate-500">Department</span><p>{String(teacher.department ?? "—")}</p></div>
        <div><span className="text-slate-500">Designation</span><p>{String(teacher.designation ?? "—")}</p></div>
        <div><span className="text-slate-500">Status</span><p>{String(teacher.status ?? "—")}</p></div>
        <div><span className="text-slate-500">Qualification</span><p>{String(teacher.qualification ?? "—")}</p></div>
        <div><span className="text-slate-500">Experience</span><p>{String(teacher.experience ?? "—")}</p></div>
      </div>
      <div className="gs-card p-4">
        <h3 className="font-semibold">Assigned Classes / Subjects</h3>
        {assignments.length ? (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {assignments.map((item) => (
              <li key={item.label}>{item.label}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No class/subject assignments yet. Assign via Sections (class teacher) or Timetable.
          </p>
        )}
      </div>
    </div>
  );
}
