import type { SubjectAttendanceItem } from "@/components/attendance/types";

export function SubjectAttendanceList({ items }: { items: SubjectAttendanceItem[] }) {
  return (
    <div className="gs-card p-4">
      <h3 className="font-semibold">Subject-wise Attendance</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((row) => (
            <li key={row.subjectCode || row.subjectName} className="rounded-lg border p-3">
              <p className="font-medium text-[#0b1b3a]">{row.subjectName}</p>
              <p className="text-slate-600">
                Present: {row.present} · Absent: {row.absent}
                {row.late ? ` · Late: ${row.late}` : ""}
                {row.leave ? ` · Leave: ${row.leave}` : ""} · {row.percentage}%
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No subject-wise attendance for the selected period.</p>
      )}
    </div>
  );
}
