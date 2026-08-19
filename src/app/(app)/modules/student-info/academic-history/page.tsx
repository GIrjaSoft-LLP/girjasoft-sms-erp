"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PROMOTION_STATUS_LABELS } from "@/config/promotion";
import { api } from "@/lib/client";

type HistoryRow = {
  _id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  academicSessionName: string;
  className: string;
  sectionName: string;
  rollNumber: string;
  promotionStatus: string;
  isCurrent: boolean;
};

export default function AcademicHistoryPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    api<{ rows: HistoryRow[] }>(`/api/student-info/academic-history${params}`)
      .then((data) => setRows(data.rows ?? []))
      .catch(() => setRows([]));
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="gs-card p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Search Student</span>
          <input className="gs-input max-w-md" placeholder="Name or admission number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">Student</th>
              <th className="p-3">Admission No.</th>
              <th className="p-3">Session</th>
              <th className="p-3">Class</th>
              <th className="p-3">Section</th>
              <th className="p-3">Roll No.</th>
              <th className="p-3">Status</th>
              <th className="p-3">Current</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-b">
                <td className="p-3">
                  <Link href={`/modules/student-info/students/${row.studentId}`} className="text-[#4c7eff] hover:underline">
                    {row.studentName}
                  </Link>
                </td>
                <td className="p-3">{row.admissionNumber}</td>
                <td className="p-3">{row.academicSessionName}</td>
                <td className="p-3">{row.className}</td>
                <td className="p-3">{row.sectionName}</td>
                <td className="p-3">{row.rollNumber || "—"}</td>
                <td className="p-3">{PROMOTION_STATUS_LABELS[row.promotionStatus as keyof typeof PROMOTION_STATUS_LABELS] ?? row.promotionStatus}</td>
                <td className="p-3">{row.isCurrent ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
