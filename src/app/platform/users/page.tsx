"use client";

import { useEffect, useState } from "react";
import { PasswordDialog } from "@/components/PasswordDialog";
import { api } from "@/lib/client";

type PlatformUser = {
  _id: string;
  name: string;
  email: string;
  username?: string;
  status: string;
  lastLoginAt?: string;
  workspace?: { schoolName?: string; code?: string };
};

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [error, setError] = useState("");
  const [passwordUser, setPasswordUser] = useState<PlatformUser | null>(null);

  async function load() {
    const data = await api<{ items: PlatformUser[] }>("/api/platform/workspaces/users");
    setUsers(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function removeUser(user: PlatformUser) {
    if (!confirm(`Remove ${user.name} from ${user.workspace?.schoolName ?? "workspace"}?`)) return;
    await api(`/api/platform/users/${user._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workspace Users</h1>
        <p className="text-slate-500">Change passwords or remove users across workspaces. Super Admin is never listed.</p>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Workspace</th>
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
                <td className="p-3">
                  {user.workspace?.schoolName ?? "—"} {user.workspace?.code ? `(${user.workspace.code})` : ""}
                </td>
                <td className="p-3">{user.status}</td>
                <td className="p-3">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</td>
                <td className="p-3 space-x-3 whitespace-nowrap">
                  <button className="text-[#4c7eff]" onClick={() => setPasswordUser(user)}>
                    Change password
                  </button>
                  <button className="text-red-600" onClick={() => removeUser(user)}>
                    Remove user
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {passwordUser ? (
        <PasswordDialog
          title={`Change password for ${passwordUser.name}`}
          onClose={() => setPasswordUser(null)}
          onSave={async (password) => {
            await api(`/api/platform/users/${passwordUser._id}`, {
              method: "PATCH",
              body: JSON.stringify({ password }),
            });
          }}
        />
      ) : null}
    </div>
  );
}
