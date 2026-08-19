import type { AttendanceSummaryData } from "@/components/attendance/types";

export function AttendanceSummary({ summary, title = "Class Attendance Summary" }: { summary: AttendanceSummaryData; title?: string }) {
  return (
    <div className="gs-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="text-slate-500">Working Days</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.workingDays}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Present</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.present}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Absent</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.absent}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Late</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.late}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Leave</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.leave}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Attendance %</dt>
          <dd className="font-medium text-[#0b1b3a]">{summary.percentage}%</dd>
        </div>
      </dl>
    </div>
  );
}
