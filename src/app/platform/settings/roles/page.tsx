"use client";

import { useEffect, useState } from "react";
import { RecordDialog } from "@/components/RecordDialog";
import { api } from "@/lib/client";

type Role = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  isSystem: boolean;
  permissions?: string[];
};

export default function PlatformRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Role[] }>("/api/platform/roles")
      .then((data) => setRoles(data.items))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Roles</h2>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {["Role", "Description", "Status", "Actions"].map((col) => (
                <th key={col} className="p-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role._id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{role.name}</td>
                <td className="p-3">{role.description}</td>
                <td className="p-3">{role.status}</td>
                <td className="p-3">
                  <button type="button" className="text-[#4c7eff]" onClick={() => setSelected(role)}>
                    View
                  </button>
                  {role.isSystem ? null : (
                    <button type="button" className="ml-3 text-slate-600" disabled>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <RecordDialog title={`${selected.name} Role`} onClose={() => setSelected(null)}>
          <div className="space-y-3 text-sm">
            <p>{selected.description}</p>
            <p className="text-slate-500">{selected.isSystem ? "System role permissions are managed by the platform." : "Custom role editing is not enabled yet."}</p>
            <div>
              <p className="mb-2 font-medium">Permissions</p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {(selected.permissions ?? []).map((permission) => (
                  <li key={permission}>{permission}</li>
                ))}
              </ul>
            </div>
          </div>
        </RecordDialog>
      ) : null}
    </div>
  );
}
