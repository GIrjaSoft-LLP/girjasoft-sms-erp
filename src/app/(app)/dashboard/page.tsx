"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/config/branding";
import { api } from "@/lib/client";

export default function DashboardPage() {
  const [data, setData] = useState<{
    workspace: { schoolName: string; logo?: string };
    stats: Record<string, number | string>;
  } | null>(null);

  useEffect(() => {
    api<typeof data>("/api/dashboard").then(setData);
  }, []);

  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{APP_NAME}</p>
        <h1 className="text-2xl font-semibold">{data?.workspace.schoolName ?? "Workspace Dashboard"}</h1>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ["Students", stats.students],
          ["Teachers", stats.teachers],
          ["Staff", stats.staff],
          ["Classes", stats.classes],
          ["Sections", stats.sections],
          [`Attendance (${stats.attendanceDate || "latest"})`, stats.todayAttendance],
          ["Pending fees", stats.pendingFees],
          ["Exams", stats.exams],
          ["Results", stats.results],
          ["Notices", stats.notices],
        ].map(([label, value]) => (
          <div key={String(label)} className="gs-card p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-semibold">{value ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
