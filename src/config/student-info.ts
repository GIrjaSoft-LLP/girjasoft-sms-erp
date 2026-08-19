import type { NavLink } from "@/config/nav";

/** Admin / staff sub-navigation inside the Student Info module. */
export const STUDENT_INFO_ADMIN_NAV: NavLink[] = [
  { href: "/modules/student-info", label: "Dashboard", permission: "students.view", exact: true },
  { href: "/modules/student-info/students", label: "Students", permission: "students.view" },
  { href: "/modules/student-info/promotion", label: "Promotion", permission: "students.promote" },
  { href: "/modules/student-info/academic-history", label: "Academic History", permission: "students.view" },
  { href: "/modules/student-info/archived", label: "Archived Students", permission: "students.view" },
  { href: "/modules/student-info/parents", label: "Parents / Guardians", permission: "parents.view" },
  { href: "/modules/student-info/classes", label: "Classes", permission: "classes.view" },
  { href: "/modules/student-info/sections", label: "Sections", permission: "sections.view" },
  { href: "/modules/student-info/subjects", label: "Subjects", permission: "subjects.view" },
];

/** Parent portal sub-navigation — same module, read-only views. */
export const STUDENT_INFO_PARENT_NAV: NavLink[] = [
  { href: "/modules/student-info", label: "Dashboard", permission: "students.view", exact: true },
  { href: "/modules/student-info/students", label: "My Children", permission: "students.view" },
];

export const STUDENT_PROFILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "personal", label: "Personal Information" },
  { key: "academic", label: "Academic Information" },
  { key: "parents", label: "Parents / Guardians" },
  { key: "attendance", label: "Attendance", permission: "attendance.view", moduleId: "attendance" },
  { key: "fees", label: "Fees", permission: "fees.view", moduleId: "online-fees" },
  { key: "examination", label: "Examination", permission: "exams.view", moduleId: "examination" },
  { key: "homework", label: "Homework", permission: "homework.view", moduleId: "homework" },
  { key: "transport", label: "Transport", permission: "transport.view", moduleId: "transport" },
  { key: "library", label: "Library", permission: "library.view", moduleId: "library" },
] as const;

/** Legacy routes consolidated under Student Info. */
export const STUDENT_INFO_LEGACY_REDIRECTS: Record<string, string> = {
  "/modules/students": "/modules/student-info/students",
  "/modules/parents": "/modules/student-info/parents",
  "/modules/classes": "/modules/student-info/classes",
  "/modules/sections": "/modules/student-info/sections",
  "/modules/subjects": "/modules/student-info/subjects",
};
