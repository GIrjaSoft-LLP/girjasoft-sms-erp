"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

type ArchivedRow = {
  _id: string;
  name: string;
  admissionNumber: string;
  status: string;
  className: string;
  sectionName: string;
  academicSessionName: string;
};

export default function ArchivedStudentsPage() {
  const [rows, setRows] = useState<ArchivedRow[]>([]);

  useEffect(() => {
    api<{ items: ArchivedRow[] }>("/api/student-info/archived")
      .then((data) => setRows(data.items))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="gs-card overflow-x-auto">
      <h2 className="px-4 pt-4 font-semibold">Archived / Graduated / Transferred Students</h2>
      <p className="mb-3 px-4 text-sm text-slate-600">These students are no longer in active operational lists but remain in the system.</p>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-3">Student</th>
            <th className="p-3">Admission No.</th>
            <th className="p-3">Status</th>
            <th className="p-3">Last Class</th>
            <th className="p-3">Session</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-b">
              <td className="p-3">
                <Link href={`/modules/student-info/students/${row._id}`} className="text-[#4c7eff] hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="p-3">{row.admissionNumber}</td>
              <td className="p-3">{row.status}</td>
              <td className="p-3">
                {row.className}
                {row.sectionName ? `-${row.sectionName}` : ""}
              </td>
              <td className="p-3">{row.academicSessionName || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
