"use client";

import { AttendanceViewPanel } from "@/components/attendance/AttendanceViewPanel";

export function StudentAttendancePanel({ studentId }: { studentId: string }) {
  return <AttendanceViewPanel mode="student" studentId={studentId} />;
}
