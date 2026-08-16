"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/config/branding";
import { api } from "@/lib/client";

type Dashboard = {
  stats: Record<string, number>;
  workspaces: Array<{
    id: string;
    name: string;
    schoolName: string;
    code: string;
    status: string;
    createdAt: string;
    lastActivityAt: string;
    users: number;
    students: number;
    admin: string;
  }>;
};

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const result = await api<Dashboard>("/api/platform/dashboard");
    setData(result);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function act(id: string, path: string) {
    await api(`/api/platform/workspaces/${id}/${path}`, { method: "POST" });
    await load();
  }

  async function openWorkspace(id: string) {
    const result = await api<{ redirectTo: string }>(`/api/platform/workspaces/${id}/open`, {
      method: "POST",
    });
    router.push(result.redirectTo);
  }

  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">{APP_NAME}</h1>
        <p className="text-slate-500">Platform Super Admin dashboard</p>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ["Total Workspaces", stats.totalWorkspaces],
          ["Active Workspaces", stats.activeWorkspaces],
          ["Disabled Workspaces", stats.disabledWorkspaces],
          ["Suspended Workspaces", stats.suspendedWorkspaces],
          ["Total Users", stats.totalUsers],
          ["Total Students", stats.totalStudents],
          ["Total Teachers", stats.totalTeachers],
          ["Total Staff", stats.totalStaff],
        ].map(([label, value]) => (
          <div key={String(label)} className="gs-card p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-semibold">{value ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Workspace Name", "Workspace ID", "Admin", "Users", "Students", "Status", "Created Date", "Last Activity", ""].map(
                (h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(data?.workspaces ?? []).map((ws) => (
              <tr key={ws.id} className="border-t">
                <td className="p-3">{ws.schoolName}</td>
                <td className="p-3">{ws.code}</td>
                <td className="p-3">{ws.admin}</td>
                <td className="p-3">{ws.users}</td>
                <td className="p-3">{ws.students}</td>
                <td className="p-3">{ws.status}</td>
                <td className="p-3">{new Date(ws.createdAt).toLocaleDateString()}</td>
                <td className="p-3">{new Date(ws.lastActivityAt).toLocaleDateString()}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button className="text-[#4c7eff]" onClick={() => openWorkspace(ws.id)}>
                    Open
                  </button>
                  <button className="text-emerald-700" onClick={() => act(ws.id, "activate")}>
                    Activate
                  </button>
                  <button className="text-amber-700" onClick={() => act(ws.id, "deactivate")}>
                    Suspend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
