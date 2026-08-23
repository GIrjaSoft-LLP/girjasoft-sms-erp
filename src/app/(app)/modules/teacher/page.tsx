"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type AdminDashboard = {
  role: "admin";
  stats: { totalTeachers: number; activeTeachers: number };
  teachers: Array<{ _id: string; name: string; employeeId: string; email: string; status: string }>;
};

type TeacherDashboard = {
  role: "teacher";
  teacherName: string;
  context?: { className: string; sectionName: string; subjectName?: string } | null;
  myClasses: Array<{
    classId: string;
    className: string;
    sections: Array<{ sectionId: string; name: string }>;
    subjects: Array<{ subjectId: string; name: string }>;
  }>;
  todaySchedule: Array<{ period: string; className: string; sectionName: string; subjectName: string }>;
  stats: { todayClasses: number; pendingAttendance: number; pendingHomework: number };
};

export default function TeacherModuleDashboardPage() {
  const [data, setData] = useState<AdminDashboard | TeacherDashboard | null>(null);

  useEffect(() => {
    api<AdminDashboard | TeacherDashboard>("/api/teacher/dashboard").then(setData).catch(() => undefined);
  }, []);

  if (!data) return <div className="gs-card p-6 text-sm text-slate-500">Loading teacher dashboard…</div>;

  if (data.role === "teacher") {
    return (
      <div className="space-y-4">
        <div className="gs-card p-4">
          <p className="text-sm text-slate-500">Good day,</p>
          <h2 className="text-xl font-semibold text-[#0b1b3a]">{data.teacherName}</h2>
          {data.context ? (
            <p className="mt-2 text-sm text-slate-600">
              Today&apos;s Class: {data.context.className}-{data.context.sectionName}
              {data.context.subjectName ? ` · ${data.context.subjectName}` : ""}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="gs-card p-4"><p className="text-xs uppercase text-slate-500">Today&apos;s Classes</p><p className="text-2xl font-semibold">{data.stats.todayClasses}</p></div>
          <div className="gs-card p-4"><p className="text-xs uppercase text-slate-500">Pending Attendance</p><p className="text-2xl font-semibold">{data.stats.pendingAttendance}</p></div>
          <div className="gs-card p-4"><p className="text-xs uppercase text-slate-500">Homework Items</p><p className="text-2xl font-semibold">{data.stats.pendingHomework}</p></div>
        </div>
        <div className="gs-card p-4">
          <h3 className="font-semibold">Quick Actions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/modules/attendance/mark" className="gs-btn px-4 py-2 text-sm">Mark Attendance</Link>
            <Link href="/modules/homework" className="gs-btn px-4 py-2 text-sm">Add Homework</Link>
            <Link href="/modules/marks" className="gs-btn px-4 py-2 text-sm">Enter Marks</Link>
            <Link href="/modules/timetable" className="gs-btn px-4 py-2 text-sm">View Timetable</Link>
          </div>
        </div>
        {data.myClasses?.length ? (
          <div className="gs-card p-4">
            <h3 className="font-semibold">My Classes</h3>
            <div className="mt-3 space-y-3">
              {data.myClasses.map((group) => (
                <div key={group.classId} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-[#0b1b3a]">{group.className}</p>
                    {group.sections[0] ? (
                      <Link
                        href={`/modules/attendance/mark?classId=${encodeURIComponent(group.classId)}&sectionId=${encodeURIComponent(group.sections[0].sectionId)}`}
                        className="text-[#4c7eff] hover:underline"
                      >
                        Mark Attendance
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-slate-600">
                    Sections: {group.sections.length ? group.sections.map((row) => row.name).join(", ") : "—"}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Subjects: {group.subjects.length ? group.subjects.map((row) => row.name).join(", ") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {data.todaySchedule.length ? (
          <div className="gs-card p-4">
            <h3 className="font-semibold">Today&apos;s Schedule</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {data.todaySchedule.map((slot) => (
                <li key={`${slot.period}-${slot.className}-${slot.sectionName}`}>
                  {slot.period}: {slot.className}-{slot.sectionName}{slot.subjectName ? ` · ${slot.subjectName}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="gs-card p-4"><p className="text-xs uppercase text-slate-500">Total Teachers</p><p className="text-2xl font-semibold">{data.stats.totalTeachers}</p></div>
        <div className="gs-card p-4"><p className="text-xs uppercase text-slate-500">Active Teachers</p><p className="text-2xl font-semibold">{data.stats.activeTeachers}</p></div>
      </div>
      <div className="gs-card overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Teachers</h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/settings/teacher-assignments" className="text-[#4c7eff] hover:underline">
              Teacher Assignment
            </Link>
            <Link href="/settings/staff" className="text-[#4c7eff] hover:underline">
              Create Teacher via Settings → Staff
            </Link>
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-2">Employee ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Profile</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.map((row) => (
              <tr key={row._id} className="border-b">
                <td className="p-2">{row.employeeId}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.email || "—"}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2"><Link href={`/modules/teacher/teachers/${row._id}`} className="text-[#4c7eff]">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
