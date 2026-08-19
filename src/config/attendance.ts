import type { NavLink } from "@/config/nav";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_TYPES = ["CLASS", "SUBJECT"] as const;
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number];

export const DEFAULT_ATTENDANCE_SETTINGS = {
  enableClassAttendance: true,
  enableSubjectAttendance: true,
  statuses: [...ATTENDANCE_STATUSES],
  lowAttendanceThreshold: 75,
  allowTeacherEdit: false,
  allowPastDaysEdit: 7,
  lockAfterSubmit: true,
};

export type AttendanceSettings = typeof DEFAULT_ATTENDANCE_SETTINGS;

export const ATTENDANCE_NAV: NavLink[] = [
  { href: "/modules/attendance", label: "Dashboard", permission: "attendance.view", exact: true },
  { href: "/modules/attendance/mark", label: "Mark Attendance", permission: "attendance.create" },
  { href: "/modules/attendance/register", label: "Attendance Register", permission: "attendance.view" },
  { href: "/modules/attendance/reports", label: "Reports", permission: "attendance.reports" },
  { href: "/modules/attendance/settings", label: "Settings", permission: "attendance.edit" },
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  LEAVE: "Leave",
};
