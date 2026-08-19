"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export default function PlatformAuditPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api<{ items: Array<Record<string, unknown>> }>("/api/platform/audit-logs")
      .then((data) => setItems(data.items))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Audit Logs</h1>
        <p className="text-sm text-slate-500">Platform activity across workspaces.</p>
      </div>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 font-medium">Time</th>
              <th className="p-3 font-medium">Actor</th>
              <th className="p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item._id)} className="border-t border-slate-100">
                <td className="p-3">{String(item.createdAt ?? "")}</td>
                <td className="p-3">{String(item.actorEmail ?? "")}</td>
                <td className="p-3">{String(item.action ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
