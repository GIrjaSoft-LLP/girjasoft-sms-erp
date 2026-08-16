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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Platform Audit Logs</h1>
      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={String(item._id)} className="border-t">
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
