"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type LowAttendanceRow = {
  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  percentage: number;
  workingDays: number;
};

type DailyRow = {
  className: string;
  sectionName: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

type StatusRow = {
  date: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  status: string;
  remarks: string;
};

type MonthlyRow = {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  percentage: number;
};

const REPORT_TYPES = [
  { id: "daily", label: "Daily Attendance" },
  { id: "monthly", label: "Monthly Attendance" },
  { id: "low-attendance", label: "Low Attendance" },
  { id: "absent", label: "Absent Students" },
  { id: "late", label: "Late Students" },
  { id: "leave", label: "Leave Report" },
] as const;

export default function AttendanceReportsPage() {
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]["id"]>("daily");
  const [threshold, setThreshold] = useState(75);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [lowRows, setLowRows] = useState<LowAttendanceRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [dailyOverall, setDailyOverall] = useState(0);
  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);

  useEffect(() => {
    if (reportType === "low-attendance") {
      api<{ rows: LowAttendanceRow[] }>(`/api/attendance/reports?type=low-attendance&threshold=${threshold}`)
        .then((data) => setLowRows(data.rows))
        .catch(() => setLowRows([]));
      return;
    }
    if (reportType === "daily") {
      api<{ rows: DailyRow[]; overall: number }>(`/api/attendance/reports?type=daily&date=${date}`)
        .then((data) => {
          setDailyRows(data.rows);
          setDailyOverall(data.overall);
        })
        .catch(() => {
          setDailyRows([]);
          setDailyOverall(0);
        });
      return;
    }
    if (reportType === "monthly") {
      api<{ rows: MonthlyRow[] }>(`/api/attendance/reports?type=monthly&month=${month}`)
        .then((data) => setMonthlyRows(data.rows))
        .catch(() => setMonthlyRows([]));
      return;
    }
    api<{ rows: StatusRow[] }>(`/api/attendance/reports?type=${reportType}`)
      .then((data) => setStatusRows(data.rows))
      .catch(() => setStatusRows([]));
  }, [reportType, threshold, date, month]);

  return (
    <div className="space-y-4">
      <div className="gs-card flex flex-wrap gap-3 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Report Type</span>
          <select className="gs-input" value={reportType} onChange={(e) => setReportType(e.target.value as typeof reportType)}>
            {REPORT_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {reportType === "low-attendance" ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Threshold (%)</span>
            <input
              className="gs-input max-w-xs"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
        ) : null}
        {reportType === "daily" ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Date</span>
            <input className="gs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        ) : null}
        {reportType === "monthly" ? (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Month</span>
            <input className="gs-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        ) : null}
      </div>

      {reportType === "daily" ? (
        <div className="gs-card overflow-x-auto">
          <h2 className="mb-1 px-4 pt-4 font-semibold">Daily Attendance Report</h2>
          <p className="mb-3 px-4 text-sm text-slate-600">Overall: {dailyOverall}%</p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-3">Class</th>
                <th className="p-3">Section</th>
                <th className="p-3">Total</th>
                <th className="p-3">Present</th>
                <th className="p-3">Absent</th>
                <th className="p-3">Late</th>
                <th className="p-3">Leave</th>
                <th className="p-3">%</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={`${row.className}-${row.sectionName}`} className="border-b">
                  <td className="p-3">{row.className}</td>
                  <td className="p-3">{row.sectionName}</td>
                  <td className="p-3">{row.totalStudents}</td>
                  <td className="p-3">{row.present}</td>
                  <td className="p-3">{row.absent}</td>
                  <td className="p-3">{row.late}</td>
                  <td className="p-3">{row.leave}</td>
                  <td className="p-3">{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "monthly" ? (
        <div className="gs-card overflow-x-auto">
          <h2 className="mb-3 px-4 pt-4 font-semibold">Monthly Attendance Report</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-3">Date</th>
                <th className="p-3">Total</th>
                <th className="p-3">Present</th>
                <th className="p-3">Absent</th>
                <th className="p-3">Late</th>
                <th className="p-3">Leave</th>
                <th className="p-3">%</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((row) => (
                <tr key={row.date} className="border-b">
                  <td className="p-3">{row.date}</td>
                  <td className="p-3">{row.total}</td>
                  <td className="p-3">{row.present}</td>
                  <td className="p-3">{row.absent}</td>
                  <td className="p-3">{row.late}</td>
                  <td className="p-3">{row.leave}</td>
                  <td className="p-3">{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "low-attendance" ? (
        <div className="gs-card overflow-x-auto">
          <h2 className="mb-3 px-4 pt-4 font-semibold">Low Attendance Report</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-3">Student</th>
                <th className="p-3">Admission No.</th>
                <th className="p-3">Class</th>
                <th className="p-3">Working Days</th>
                <th className="p-3">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {lowRows.map((row) => (
                <tr key={`${row.admissionNumber}-${row.studentName}`} className="border-b">
                  <td className="p-3">{row.studentName}</td>
                  <td className="p-3">{row.admissionNumber}</td>
                  <td className="p-3">
                    {row.className}
                    {row.sectionName ? `-${row.sectionName}` : ""}
                  </td>
                  <td className="p-3">{row.workingDays}</td>
                  <td className="p-3">{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reportType === "absent" || reportType === "late" || reportType === "leave" ? (
        <div className="gs-card overflow-x-auto">
          <h2 className="mb-3 px-4 pt-4 font-semibold capitalize">{reportType} Student Report</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-3">Date</th>
                <th className="p-3">Student</th>
                <th className="p-3">Admission No.</th>
                <th className="p-3">Class</th>
                <th className="p-3">Remark</th>
              </tr>
            </thead>
            <tbody>
              {statusRows.map((row) => (
                <tr key={`${row.date}-${row.admissionNumber}`} className="border-b">
                  <td className="p-3">{row.date}</td>
                  <td className="p-3">{row.studentName}</td>
                  <td className="p-3">{row.admissionNumber}</td>
                  <td className="p-3">
                    {row.className}
                    {row.sectionName ? `-${row.sectionName}` : ""}
                  </td>
                  <td className="p-3">{row.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
