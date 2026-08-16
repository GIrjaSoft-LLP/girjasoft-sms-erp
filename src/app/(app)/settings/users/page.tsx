"use client";

import { useEffect, useState } from "react";
import { ExcelActions } from "@/components/ExcelActions";
import { PasswordDialog } from "@/components/PasswordDialog";
import { RecordDialog } from "@/components/RecordDialog";
import { DEFAULT_USER_PASSWORD } from "@/config/defaults";
import { api } from "@/lib/client";

type Role = { _id: string; name: string; slug?: string };
type UserRow = {
  _id: string;
  name: string;
  email: string;
  username: string;
  department: string;
  status: string;
  lastLoginAt?: string;
  roleIds: Array<{ name: string }>;
};

export default function UsersPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meId, setMeId] = useState("");
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    department: "",
    employeeId: "",
    roleIds: [] as string[],
    status: "ACTIVE",
  };
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load(next?: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const search = next?.q ?? q;
    const status = next?.status ?? statusFilter;
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const [roleData, userData, me] = await Promise.all([
      api<{ items: Role[] }>("/api/roles"),
      api<{ items: UserRow[] }>(`/api/users${suffix}`),
      api<{ user: { email?: string } }>("/api/auth/me"),
    ]);
    setRoles(
      roleData.items.filter(
        (role) => role.slug !== "parent" && role.slug !== "student" && role.slug !== "teacher",
      ),
    );
    setUsers(userData.items);
    const mine = userData.items.find((user) => user.email === me.user.email);
    setMeId(mine?._id ?? "");
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          password: form.password || DEFAULT_USER_PASSWORD,
        }),
      });
      setForm(emptyForm);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function toggle(user: UserRow) {
    await api(`/api/users/${user._id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    });
    await load();
  }

  async function removeUser(user: UserRow) {
    if (!confirm(`Remove ${user.name} from this workspace? This cannot be undone.`)) return;
    await api(`/api/users/${user._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Users</h2>
          <p className="text-sm text-slate-500">
            Generic workspace accounts. Teacher and parent logins are managed from their own sections.
            New users get default password <code>{DEFAULT_USER_PASSWORD}</code> unless you set another.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelActions
            exportUrl="/api/users/excel"
            templateUrl="/api/users/excel?template=1"
            importUrl="/api/users/excel"
            onImported={load}
          />
          <button
            type="button"
            className="gs-btn px-4 py-2"
            onClick={() => {
              setForm(emptyForm);
              setFormError("");
              setDialogOpen(true);
            }}
          >
            Create
          </button>
        </div>
      </div>
      {error ? <p className="text-red-600 text-sm">{error}</p> : null}
      <div className="gs-card p-4 grid md:grid-cols-4 gap-3 items-end">
        <label className="text-sm md:col-span-2">
          <span className="block mb-1 text-slate-600">Search</span>
          <input
            className="gs-input"
            placeholder="Name, email or username"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                load().catch((err) => setError(err.message));
              }
            }}
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-slate-600">Status</span>
          <select
            className="gs-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              load({ status: e.target.value }).catch((err) => setError(err.message));
            }}
          >
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" className="gs-btn px-4 py-2" onClick={() => load().catch((err) => setError(err.message))}>
            Search
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm text-slate-600"
            onClick={() => {
              setQ("");
              setStatusFilter("");
              load({ q: "", status: "" }).catch((err) => setError(err.message));
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last login</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-t">
                <td className="p-3">{user.name}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{user.roleIds?.map((r) => r.name).join(", ")}</td>
                <td className="p-3">{user.status}</td>
                <td className="p-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</td>
                <td className="p-3 space-x-3 whitespace-nowrap">
                  <button className="text-[#4c7eff]" onClick={() => setPasswordUser(user)}>
                    Change password
                  </button>
                  <button className="text-amber-700" onClick={() => toggle(user)}>
                    {user.status === "ACTIVE" ? "Disable" : "Activate"}
                  </button>
                  {user._id !== meId ? (
                    <button className="text-red-600" onClick={() => removeUser(user)}>
                      Remove user
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen ? (
        <RecordDialog
          title="Create user"
          onClose={() => {
            setDialogOpen(false);
            setFormError("");
          }}
        >
          <form onSubmit={createUser} className="grid md:grid-cols-2 gap-3">
            {(["name", "email", "phone", "username", "department", "employeeId"] as const).map((key) => (
              <label key={key} className="text-sm capitalize">
                {key}
                <input
                  className="gs-input mt-1"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required={["name", "email", "username"].includes(key)}
                />
              </label>
            ))}
            <label className="text-sm">
              Password
              <input
                className="gs-input mt-1"
                type="password"
                placeholder={`Default: ${DEFAULT_USER_PASSWORD}`}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Role
              <select
                className="gs-input mt-1"
                value={form.roleIds[0] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, roleIds: e.target.value ? [e.target.value] : [] }))}
                required
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
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
              <button className="gs-btn px-4 py-2">Create</button>
            </div>
          </form>
        </RecordDialog>
      ) : null}
      {passwordUser ? (
        <PasswordDialog
          title={`Change password for ${passwordUser.name}`}
          onClose={() => setPasswordUser(null)}
          onSave={async (password) => {
            await api(`/api/users/${passwordUser._id}`, {
              method: "PATCH",
              body: JSON.stringify({ password }),
            });
          }}
        />
      ) : null}
    </div>
  );
}
