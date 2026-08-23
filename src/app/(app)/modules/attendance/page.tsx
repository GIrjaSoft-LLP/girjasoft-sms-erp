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
    classId: string;
    sectionId: string;
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
          <h2 className="font-semibold">Today&apos;s Attendance</h2>
          {data.classWise.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.classWise.map((item) => (
                <li key={`${item.classId}-${item.sectionId}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {item.className} - {item.sectionName}
                    {item.marked ? ` · ${item.percent}% present` : " · Pending"}
                  </span>
                  <Link
                    href={`/modules/attendance/mark?classId=${encodeURIComponent(item.classId)}&sectionId=${encodeURIComponent(item.sectionId)}`}
                    className="text-[#4c7eff] hover:underline"
                  >
                    Mark Attendance
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No assigned classes found for today.</p>
          )}
          <Link href="/modules/attendance/mark" className="mt-3 inline-block text-sm text-[#4c7eff] hover:underline">
            Open Mark Attendance
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
      <div>
        {adminToday && !adminToday.scopes.allAccess ? (
          <h2 className="mb-3 text-lg font-semibold text-[#0b1b3a]">Attendance History</h2>
        ) : null}
        <AttendanceViewPanel onStudentChange={handleParentChildChange} />
      </div>
    </div>
  );
}
