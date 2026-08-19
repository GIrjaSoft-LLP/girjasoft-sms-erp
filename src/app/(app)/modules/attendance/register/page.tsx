"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type RegisterRow = {
  _id: string;
  date: string;
  className: string;
  sectionName: string;
  subjectName: string;
  attendanceType: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  status: string;
};

export default function AttendanceRegisterPage() {
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const data = await api<{ rows: RegisterRow[] }>(`/api/attendance/register?${params}`);
    setRows(data.rows);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="gs-card grid gap-3 p-4 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">From</span>
          <input className="gs-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">To</span>
          <input className="gs-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" className="gs-btn px-4 py-2" onClick={() => void load()}>
            Filter
          </button>
        </div>
      </div>

      <div className="gs-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="p-3">Date</th>
              <th className="p-3">Class</th>
              <th className="p-3">Section</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Type</th>
              <th className="p-3">Present</th>
              <th className="p-3">Absent</th>
              <th className="p-3">Late</th>
              <th className="p-3">Leave</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-b">
                <td className="p-3">{row.date}</td>
                <td className="p-3">{row.className}</td>
                <td className="p-3">{row.sectionName}</td>
                <td className="p-3">{row.subjectName}</td>
                <td className="p-3">{row.attendanceType}</td>
                <td className="p-3">{row.present}</td>
                <td className="p-3">{row.absent}</td>
                <td className="p-3">{row.late}</td>
                <td className="p-3">{row.leave}</td>
                <td className="p-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
