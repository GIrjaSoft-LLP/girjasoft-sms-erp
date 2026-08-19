"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/config/branding";
import { formatDisplayDate } from "@/lib/workspace-validity";
import { api } from "@/lib/client";

type WorkspaceRow = {
  id: string;
  name: string;
  schoolName: string;
  code: string;
  status: string;
  subscriptionStatus: string;
  validityTill: string;
  daysLabel: string;
  createdAt: string;
  lastActivityAt: string;
  users: number;
  students: number;
  admin: string;
};

type Dashboard = {
  stats: Record<string, number>;
  workspaces: WorkspaceRow[];
};

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [result, me] = await Promise.all([
      api<Dashboard>("/api/platform/dashboard"),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setData(result);
    setPermissions(me.user.permissions ?? []);
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

  const can = (permission: string) => permissions.includes(permission);
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{APP_NAME}</p>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Platform Administration</h1>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-4">
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
              {[
                "Workspace",
                "Status",
                "Validity Till",
                "Days Remaining",
                "Admin",
                "Users",
                "Students",
                "Created Date",
                "Last Activity",
                "Actions",
              ].map((h) => (
                <th key={h} className="p-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.workspaces ?? []).map((ws) => (
              <tr key={ws.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{ws.schoolName}</div>
                  <div className="text-xs text-slate-500">{ws.code}</div>
                </td>
                <td className="p-3">{ws.subscriptionStatus || ws.status}</td>
                <td className="p-3">{ws.validityTill ? formatDisplayDate(ws.validityTill) : "—"}</td>
                <td className="p-3">{ws.daysLabel || "—"}</td>
                <td className="p-3">{ws.admin}</td>
                <td className="p-3">{ws.users}</td>
                <td className="p-3">{ws.students}</td>
                <td className="p-3">{new Date(ws.createdAt).toLocaleDateString()}</td>
                <td className="p-3">{new Date(ws.lastActivityAt).toLocaleDateString()}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  {can("platform.workspaces.manage") ? (
                    <button className="text-[#4c7eff]" type="button" onClick={() => openWorkspace(ws.id)}>
                      Open
                    </button>
                  ) : null}
                  {can("platform.workspaces.manage") ? (
                    <>
                      <button className="text-emerald-700" type="button" onClick={() => act(ws.id, "activate")}>
                        Activate
                      </button>
                      <button className="text-amber-700" type="button" onClick={() => act(ws.id, "deactivate")}>
                        Suspend
                      </button>
                    </>
                  ) : null}
                  {can("platform.workspaces.view") ? (
                    <>
                      <Link className="text-[#4c7eff]" href={`/platform/workspaces/${ws.id}/edit`}>
                        {can("platform.workspaces.edit") ? "Edit" : "View"}
                      </Link>
                      <Link className="text-slate-700" href={`/platform/workspaces/${ws.id}/modules`}>
                        Modules
                      </Link>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
