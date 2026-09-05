"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type SlipRow = {
  _id: string;
  staffName: string;
  employeeId: string;
  month: string;
  basic: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: string;
};

function money(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function TeacherSalarySlipsPanel({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<SlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: SlipRow[] }>("/api/payroll/slips");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load salary slips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold gs-heading">Salary Slips</h1>
          <p className="text-sm gs-muted">Paid salary slips appear here after payroll is marked paid by the office.</p>
        </div>
      ) : (
        <p className="text-sm gs-muted">Paid salary slips appear here after payroll is marked paid by the office.</p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="gs-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 font-medium">Month</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Basic</th>
              <th className="p-3 font-medium">Allowances</th>
              <th className="p-3 font-medium">Deductions</th>
              <th className="p-3 font-medium">Net Pay</th>
              <th className="p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-slate-500">
                  Loading salary slips…
                </td>
              </tr>
            ) : items.length ? (
              items.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="p-3">{row.month}</td>
                  <td className="p-3">{row.staffName}</td>
                  <td className="p-3">{money(row.basic)}</td>
                  <td className="p-3">{money(row.allowances)}</td>
                  <td className="p-3">{money(row.deductions)}</td>
                  <td className="p-3 font-medium">{money(row.netPay)}</td>
                  <td className="p-3">
                    <a className="text-[#4c7eff] hover:underline" href={`/print/payroll/${row._id}`} target="_blank" rel="noreferrer">
                      View / Print
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-4 text-slate-500">
                  No paid salary slips yet. Draft payroll is not shown until it is marked paid.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
