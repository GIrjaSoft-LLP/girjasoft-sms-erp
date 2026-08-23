import type { NavLink } from "@/config/nav";

export const TEACHER_NAV: NavLink[] = [
  { href: "/modules/teacher", label: "Dashboard", permission: "teachers.view", exact: true },
  { href: "/modules/teacher/teachers", label: "Teachers", permission: "teachers.view" },
  { href: "/modules/teacher/timetable", label: "Timetable", permission: "timetable.view" },
  { href: "/modules/teacher/attendance", label: "Attendance", permission: "attendance.view" },
];

export const TEACHER_PORTAL_NAV: NavLink[] = [
  { href: "/modules/teacher", label: "Dashboard", permission: "teachers.view", exact: true },
  { href: "/modules/attendance", label: "Attendance", permission: "attendance.view" },
  { href: "/modules/timetable", label: "Timetable", permission: "timetable.view" },
  { href: "/modules/homework", label: "Homework", permission: "homework.view" },
  { href: "/modules/marks", label: "Marks", permission: "marks.view" },
];
