"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AttendanceViewPanel } from "@/components/attendance/AttendanceViewPanel";
import { api } from "@/lib/client";

type AdminDashboard = {
  role: "admin";
  stats: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    leaveToday: number;
    attendancePercent: number;
    pendingAttendance: number;
  };
  classWise: Array<{
    className: string;
    sectionName: string;
    totalStudents: number;
    present: number;
    percent: number;
    marked: boolean;
  }>;
  scopes: {
    allAccess: boolean;
    classTeacher: Array<{ label: string }>;
    subjectTeacher: Array<{ label: string }>;
  };
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gs-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#0b1b3a]">{value}</p>
    </div>
  );
}

function AdminTodayStrip({ data }: { data: AdminDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total Students" value={data.stats.totalStudents} />
        <StatCard label="Present Today" value={data.stats.presentToday} />
        <StatCard label="Absent Today" value={data.stats.absentToday} />
        <StatCard label="Late Today" value={data.stats.lateToday} />
        <StatCard label="On Leave" value={data.stats.leaveToday} />
        <StatCard label="Attendance %" value={`${data.stats.attendancePercent}%`} />
        <StatCard label="Pending" value={data.stats.pendingAttendance} />
      </div>

      {!data.scopes.allAccess ? (
        <div className="gs-card p-4">
          <h2 className="font-semibold">My Attendance Classes</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {[...data.scopes.classTeacher, ...data.scopes.subjectTeacher].map((item) => (
              <li key={item.label}>{item.label}</li>
            ))}
          </ul>
          <Link href="/modules/attendance/mark" className="mt-3 inline-block text-sm text-[#4c7eff] hover:underline">
            Mark Attendance
          </Link>
        </div>
      ) : (
        <div className="flex justify-end">
          <Link href="/modules/attendance/mark" className="text-sm text-[#4c7eff] hover:underline">
            Mark Attendance
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AttendanceDashboardPage() {
  const [adminToday, setAdminToday] = useState<AdminDashboard | null>(null);

  useEffect(() => {
    api<AdminDashboard>("/api/attendance/dashboard")
      .then((payload) => {
        if (payload.role === "admin") setAdminToday(payload);
      })
      .catch(() => undefined);
  }, []);

  const handleParentChildChange = useCallback(async (studentId: string) => {
    await api("/api/auth/active-child", {
      method: "POST",
      body: JSON.stringify({ studentId }),
    });
  }, []);

  return (
    <div className="space-y-6">
      {adminToday ? <AdminTodayStrip data={adminToday} /> : null}
      <AttendanceViewPanel onStudentChange={handleParentChildChange} />
    </div>
  );
}
