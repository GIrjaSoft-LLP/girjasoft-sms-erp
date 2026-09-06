"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/client";

type ArchivedWorkspace = {
  id: string;
  name: string;
  schoolName: string;
  code: string;
  website: string;
  status: string;
  users: number;
  admin: { name?: string; email?: string } | null;
  archivedAt?: string;
  archivedByEmail?: string;
};

const PAGE_SIZE = 20;

export default function ArchivedWorkspacesPage() {
  const [items, setItems] = useState<ArchivedWorkspace[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<ArchivedWorkspace | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [data, me] = await Promise.all([
      api<{ items: ArchivedWorkspace[] }>("/api/platform/archived/workspaces"),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setItems(data.items);
    setPermissions(me.user.permissions ?? []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) =>
      [row.schoolName, row.name, row.code, row.website, row.admin?.name, row.admin?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canManage = permissions.includes("platform.workspaces.manage");
  const canView = permissions.includes("platform.workspaces.view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Archived Workspaces</h1>
        <p className="text-sm text-slate-500">Workspaces removed from the active dashboard. Data is preserved.</p>
      </div>
      <input
        className="gs-input max-w-md"
        placeholder="Search by name, workspace ID, or domain"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(1);
        }}
      />
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Workspace Name", "Workspace Domain", "Workspace ID", "Admin/Owner", "Users", "Archived Date", "Archived By", "Status", "Actions"].map(
                (label) => (
                  <th key={label} className="p-3 font-medium">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{row.schoolName || row.name}</div>
                  <div className="text-xs text-slate-500">{row.name}</div>
                </td>
                <td className="p-3">{row.website || "—"}</td>
                <td className="p-3">{row.code}</td>
                <td className="p-3">{row.admin?.name ?? "—"}</td>
                <td className="p-3">{row.users}</td>
                <td className="p-3">{row.archivedAt ? new Date(row.archivedAt).toLocaleString() : "—"}</td>
                <td className="p-3">{row.archivedByEmail || "—"}</td>
                <td className="p-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Archived</span>
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  {canView ? (
                    <Link className="text-[#4c7eff]" href={`/platform/workspaces/${row.id}/edit`}>
                      View
                    </Link>
                  ) : null}
                  {canManage ? (
                    <button className="text-emerald-700" type="button" onClick={() => setRestoreTarget(row)}>
                      Restore
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={9}>
                  No archived workspaces found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" className="rounded-lg border px-3 py-1" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="rounded-lg border px-3 py-1" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      ) : null}
      {restoreTarget ? (
        <ConfirmDialog
          title="Restore workspace"
          confirmLabel="Restore Workspace"
          busy={busy}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/api/platform/workspaces/${restoreTarget.id}/restore`, { method: "POST" });
              setRestoreTarget(null);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Restore failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Restore this workspace and its associated users?</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
