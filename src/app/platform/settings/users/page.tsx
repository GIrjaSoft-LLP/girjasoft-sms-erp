"use client";

import { useEffect, useState } from "react";
import { DEFAULT_USER_PASSWORD } from "@/config/defaults";
import { PhotoField } from "@/components/PhotoField";
import { RecordDialog } from "@/components/RecordDialog";
import { api } from "@/lib/client";

type Admin = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  photo?: string;
};

export default function PlatformUsersSettingsPage() {
  const [items, setItems] = useState<Admin[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<Admin | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: DEFAULT_USER_PASSWORD,
    role: "READER",
    status: "ACTIVE",
  });
  const [error, setError] = useState("");

  async function load() {
    const [users, me] = await Promise.all([
      api<{ items: Admin[] }>("/api/platform/admins"),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setItems(users.items);
    setPermissions(me.user.permissions ?? []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const canCreate = permissions.includes("platform.users.create");
  const canEdit = permissions.includes("platform.users.edit");
  const canDelete = permissions.includes("platform.users.delete");

  function openCreate() {
    setEditUser(null);
    setPhotoFile(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      username: "",
      password: DEFAULT_USER_PASSWORD,
      role: "READER",
      status: "ACTIVE",
    });
    setDialogOpen(true);
  }

  function openEdit(user: Admin) {
    setEditUser(user);
    setPhotoFile(null);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      username: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setDialogOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (editUser) {
        await api(`/api/platform/admins/${editUser._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            role: form.role,
            status: form.status,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        if (photoFile) {
          const body = new FormData();
          body.append("file", photoFile);
          await fetch(`/api/platform/admins/${editUser._id}/photo`, { method: "POST", body });
        }
      } else {
        const data = await api<{ item: { _id: string } }>("/api/platform/admins", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (photoFile) {
          const body = new FormData();
          body.append("file", photoFile);
          await fetch(`/api/platform/admins/${data.item._id}/photo`, { method: "POST", body });
        }
      }
      setDialogOpen(false);
      setPhotoFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function removeUser(user: Admin) {
    if (!canDelete) return;
    if (!confirm(`Remove ${user.name}?`)) return;
    setError("");
    try {
      await api(`/api/platform/admins/${user._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Users</h2>
        {canCreate ? (
          <button className="gs-btn px-4 py-2" type="button" onClick={openCreate}>
            + Create User
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Photo", "Name", "Email", "Role", "Status", "Actions"].map((col) => (
                <th key={col} className="p-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="border-t border-slate-100">
                <td className="p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.photo ?? `/api/platform/admins/${item._id}/photo`} alt="" className="h-9 w-9 rounded-full bg-slate-100 object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </td>
                <td className="p-3">{item.name}</td>
                <td className="p-3">{item.email}</td>
                <td className="p-3">{item.role.replace("_", " ")}</td>
                <td className="p-3">{item.status}</td>
                <td className="p-3 space-x-3 whitespace-nowrap">
                  {canEdit ? (
                    <button type="button" className="text-[#4c7eff]" onClick={() => openEdit(item)}>
                      Edit
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" className="text-red-600" onClick={() => removeUser(item)}>
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialogOpen ? (
        <RecordDialog title={editUser ? "Edit Platform User" : "Create Platform User"} onClose={() => setDialogOpen(false)}>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              Name
              <input className="gs-input mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </label>
            <label className="text-sm">
              Email
              <input className="gs-input mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled={Boolean(editUser)} />
            </label>
            <label className="text-sm">
              Username
              <input className="gs-input mt-1" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required disabled={Boolean(editUser)} />
            </label>
            <label className="text-sm">
              Phone
              <input className="gs-input mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <label className="text-sm">
              Role
              <select className="gs-input mt-1" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="ADMIN">Admin</option>
                <option value="READER">Reader</option>
                <option value="TICKET_ADMIN">Ticket Admin</option>
              </select>
            </label>
            <label className="text-sm">
              Status
              <select className="gs-input mt-1" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              {editUser ? "New Password (optional)" : "Password"}
              <input className="gs-input mt-1" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!editUser} minLength={editUser && !form.password ? undefined : 10} />
            </label>
            <PhotoField label="Profile Photo" name={form.name} photo={editUser?.photo} onPhotoChange={(file) => setPhotoFile(file)} />
            <div className="md:col-span-2">
              <button className="gs-btn px-4 py-2">{editUser ? "Save Changes" : "Create User"}</button>
            </div>
          </form>
        </RecordDialog>
      ) : null}
    </div>
  );
}
