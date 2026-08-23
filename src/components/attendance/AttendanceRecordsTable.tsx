import type { AttendanceFilterType } from "@/lib/attendance/filters";
import type { AttendanceRecordItem, DailyBreakdownItem } from "@/components/attendance/types";

type AttendanceRecordsTableProps = {
  filterType: AttendanceFilterType;
  records: AttendanceRecordItem[];
  dailyBreakdown: DailyBreakdownItem[];
  showStudentColumns?: boolean;
  title?: string;
};

export function AttendanceRecordsTable({
  filterType,
  records,
  dailyBreakdown,
  showStudentColumns = false,
  title = "Attendance Records",
}: AttendanceRecordsTableProps) {
  if (filterType === "week" || filterType === "month") {
    return (
      <div className="gs-card overflow-x-auto p-4">
        <h3 className="font-semibold">Daily Attendance</h3>
        {dailyBreakdown.length ? (
          <table className="mt-3 min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-2">Date</th>
                <th className="p-2">Present</th>
                <th className="p-2">Absent</th>
                <th className="p-2">Late</th>
                <th className="p-2">Leave</th>
              </tr>
            </thead>
            <tbody>
              {dailyBreakdown.map((row) => (
                <tr key={row.date} className="border-b">
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.present}</td>
                  <td className="p-2">{row.absent}</td>
                  <td className="p-2">{row.late}</td>
                  <td className="p-2">{row.leave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No attendance records for the selected period.</p>
        )}
      </div>
    );
  }

  return (
    <div className="gs-card overflow-x-auto p-4">
      <h3 className="font-semibold">{title}</h3>
      {records.length ? (
        <table className="mt-3 min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              {showStudentColumns ? (
                <>
                  <th className="p-2">Student</th>
                  <th className="p-2">Admission No.</th>
                  <th className="p-2">Class</th>
                  <th className="p-2">Section</th>
                </>
              ) : null}
              <th className="p-2">Date</th>
              <th className="p-2">Type</th>
              <th className="p-2">Subject</th>
              <th className="p-2">Status</th>
              <th className="p-2">Remark</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={`${row.date}-${row.studentId ?? ""}-${row.subjectName}-${index}`} className="border-b">
                {showStudentColumns ? (
                  <>
                    <td className="p-2">{row.studentName || "—"}</td>
                    <td className="p-2">{row.admissionNumber || "—"}</td>
                    <td className="p-2">{row.className || "—"}</td>
                    <td className="p-2">{row.sectionName || "—"}</td>
                  </>
                ) : null}
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.attendanceType === "SUBJECT" ? "Subject" : "Class"}</td>
                <td className="p-2">{row.subjectName || "—"}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">{row.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No attendance records for the selected period.</p>
      )}
    </div>
  );
}
