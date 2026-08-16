"use client";

import { useEffect, useState } from "react";
import { RecordDialog } from "@/components/RecordDialog";
import { api } from "@/lib/client";

type Module = { key: string; label: string; actions: string[] };
type Role = {
  _id: string;
  name: string;
  department: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<Module[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [draft, setDraft] = useState({ name: "", department: "", description: "", permissions: [] as string[] });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    const data = await api<{ items: Role[]; catalog: Module[] }>("/api/roles");
    setRoles(data.items);
    setCatalog(data.catalog);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function toggle(permission: string) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((p) => p !== permission)
        : [...current.permissions, permission],
    }));
  }

  function openCreate() {
    setSelected(null);
    setDraft({ name: "", department: "", description: "", permissions: [] });
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setSelected(role);
    setDraft({
      name: role.name,
      department: role.department,
      description: role.description,
      permissions: role.permissions,
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    try {
      if (selected) {
        await api(`/api/roles/${selected._id}`, { method: "PATCH", body: JSON.stringify(draft) });
      } else {
        await api("/api/roles", { method: "POST", body: JSON.stringify(draft) });
      }
      setSelected(null);
      setDraft({ name: "", department: "", description: "", permissions: [] });
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Roles & Permissions</h2>
        <button type="button" className="gs-btn px-4 py-2" onClick={openCreate}>
          Create
        </button>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="gs-card p-3 space-y-1">
          <input
            className="gs-input mb-2"
            placeholder="Search roles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {roles
            .filter((role) => role.name.toLowerCase().includes(q.trim().toLowerCase()))
            .map((role) => (
            <button
              key={role._id}
              className="w-full text-left px-3 py-2 rounded hover:bg-slate-50"
              onClick={() => openEdit(role)}
            >
              <span className="font-medium">{role.name}</span>
              <span className="block text-xs text-slate-500">{role.department || "No department"}</span>
            </button>
          ))}
      </div>
      {dialogOpen ? (
        <RecordDialog
          title={selected ? `Edit ${selected.name}` : "Create role"}
          onClose={() => {
            setDialogOpen(false);
            setFormError("");
          }}
        >
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">
                Role Name
                <input className="gs-input mt-1" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
              </label>
              <label className="text-sm">
                Department
                <input className="gs-input mt-1" value={draft.department} onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))} />
              </label>
              <label className="text-sm md:col-span-2">
                Description
                <textarea className="gs-input mt-1" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Module</th>
                    {["view", "create", "edit", "delete"].map((a) => (
                      <th key={a} className="p-2 capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((mod) => (
                    <tr key={mod.key} className="border-t">
                      <td className="p-2">{mod.label}</td>
                      {["view", "create", "edit", "delete"].map((action) => {
                        const key = `${mod.key}.${action}`;
                        const allowed = mod.actions.includes(action);
                        return (
                          <td key={action} className="p-2">
                            {allowed ? (
                              <input type="checkbox" checked={draft.permissions.includes(key)} onChange={() => toggle(key)} />
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm text-slate-600"
                onClick={() => {
                  setDialogOpen(false);
                  setFormError("");
                }}
              >
                Cancel
              </button>
              <button className="gs-btn px-4 py-2">{selected ? "Update" : "Create"}</button>
            </div>
          </form>
        </RecordDialog>
      ) : null}
    </div>
  );
}
