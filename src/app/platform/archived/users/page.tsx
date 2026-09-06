"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type ArchivedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  archivedAt?: string | null;
  roles: string[];
  workspace: { schoolName?: string; code?: string; website?: string } | null;
};

const PAGE_SIZE = 20;

export default function ArchivedUsersPage() {
  const [items, setItems] = useState<ArchivedUser[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: ArchivedUser[] }>("/api/platform/archived/users")
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) =>
      [row.name, row.email, row.phone, row.workspace?.schoolName, row.workspace?.code, ...(row.roles ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Archived Users</h1>
        <p className="text-sm text-slate-500">Users belonging to archived workspaces. Workspace relationships are kept.</p>
      </div>
      <input
        className="gs-input max-w-md"
        placeholder="Search by name, email, role, or workspace"
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
              {["User Name", "Email", "Mobile", "Role", "Workspace", "Workspace Domain", "Archived Date", "Status"].map((label) => (
                <th key={label} className="p-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-3">{row.name}</td>
                <td className="p-3">{row.email}</td>
                <td className="p-3">{row.phone || "—"}</td>
                <td className="p-3">{row.roles.join(", ") || "—"}</td>
                <td className="p-3">
                  {row.workspace?.schoolName ?? "—"}
                  {row.workspace?.code ? ` (${row.workspace.code})` : ""}
                </td>
                <td className="p-3">{row.workspace?.website || "—"}</td>
                <td className="p-3">{row.archivedAt ? new Date(row.archivedAt).toLocaleString() : "—"}</td>
                <td className="p-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Archived</span>
                </td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td className="p-6 text-slate-500" colSpan={8}>
                  No archived users found.
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
    </div>
  );
}
