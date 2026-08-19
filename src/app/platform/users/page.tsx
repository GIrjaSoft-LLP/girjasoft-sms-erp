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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [passwordUser, setPasswordUser] = useState<PlatformUser | null>(null);

  async function load() {
    const [data, me] = await Promise.all([
      api<{ items: PlatformUser[] }>("/api/platform/workspaces/users"),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setUsers(data.items);
    setPermissions(me.user.permissions ?? []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function removeUser(user: PlatformUser) {
    if (!permissions.includes("platform.workspaceUsers.delete")) return;
    if (!confirm(`Remove ${user.name} from ${user.workspace?.schoolName ?? "workspace"}?`)) return;
    await api(`/api/platform/users/${user._id}`, { method: "DELETE" });
    await load();
  }

  const canEdit = permissions.includes("platform.workspaceUsers.edit");
  const canDelete = permissions.includes("platform.workspaceUsers.delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Workspace Users</h1>
        <p className="text-sm text-slate-500">Change passwords or remove users across workspaces. Super Admin is never listed.</p>
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
              {canEdit || canDelete ? <th className="p-3">Actions</th> : null}
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
                {canEdit || canDelete ? (
                  <td className="p-3 space-x-3 whitespace-nowrap">
                    {canEdit ? (
                      <button className="text-[#4c7eff]" type="button" onClick={() => setPasswordUser(user)}>
                        Change password
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button className="text-red-600" type="button" onClick={() => removeUser(user)}>
                        Remove user
                      </button>
                    ) : null}
                  </td>
                ) : null}
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
