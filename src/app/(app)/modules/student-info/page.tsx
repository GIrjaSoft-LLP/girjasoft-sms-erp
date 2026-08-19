"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type DashboardData = {
  role: "admin" | "parent";
  stats: {
    totalStudents: number;
    totalParents: number;
    activeStudents: number;
    childrenCount?: number;
    todayAttendance?: string;
    attendancePercentage?: number;
    pendingFees?: number;
    latestResult?: string;
    upcomingExam?: string;
    pendingHomework?: number;
    recentNotices?: number;
  };
  children?: Array<{
    _id: string;
    name: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
  }>;
  recentStudents: Array<{
    _id: string;
    name: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
    status: string;
  }>;
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="gs-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1b3a]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function StudentInfoDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>("/api/student-info/dashboard")
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) {
    return <div className="gs-card p-6 text-sm text-slate-500">Loading Student Info dashboard…</div>;
  }

  if (data.role === "parent") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">My Children</h2>
          <p className="text-sm text-slate-500">Select a child to view their profile and linked information.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data.children ?? []).map((child) => (
            <Link
              key={child._id}
              href={`/modules/student-info/students/${child._id}`}
              className="gs-card block p-4 transition hover:border-[#4c7eff]/40 hover:shadow-md"
            >
              <p className="font-semibold text-[#0b1b3a]">{child.name}</p>
              <p className="mt-1 text-sm text-slate-500">{child.admissionNumber}</p>
              <p className="mt-1 text-sm text-slate-600">
                {child.className}
                {child.sectionName ? ` · ${child.sectionName}` : ""}
              </p>
            </Link>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's Attendance" value={data.stats.todayAttendance ?? "—"} />
          <StatCard label="Attendance %" value={data.stats.attendancePercentage ?? "—"} />
          <StatCard label="Pending Fees" value={data.stats.pendingFees ?? 0} />
          <StatCard label="Pending Homework" value={data.stats.pendingHomework ?? 0} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={data.stats.totalStudents} />
        <StatCard label="Active Students" value={data.stats.activeStudents} />
        <StatCard label="Parents / Guardians" value={data.stats.totalParents} />
        <StatCard label="Recent Notices" value={data.stats.recentNotices ?? 0} />
      </div>
      <div className="gs-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Recent Students</h2>
          <Link href="/modules/student-info/students" className="text-sm text-[#4c7eff] hover:underline">
            View all
          </Link>
        </div>
        {data.recentStudents.length === 0 ? (
          <p className="text-sm text-slate-500">No students yet. Confirm an admission to create the first student.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentStudents.map((student) => (
              <li key={student._id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link
                    href={`/modules/student-info/students/${student._id}`}
                    className="font-medium text-[#4c7eff] hover:underline"
                  >
                    {student.name}
                  </Link>
                  <p className="text-slate-500">
                    {student.admissionNumber}
                    {student.className ? ` · ${student.className}` : ""}
                    {student.sectionName ? `-${student.sectionName}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{student.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
