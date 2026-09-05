export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "collect"
  | "export"
  | "issue"
  | "return"
  | "assign"
  | "reports"
  | "approve"
  | "verify"
  | "convert"
  | "cancel"
  | "refund"
  | "promote";

export type PermissionModule = {
  key: string;
  label: string;
  department?: string;
  actions: PermissionAction[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "students", label: "Students", department: "Academic", actions: ["view", "create", "edit", "delete", "promote", "export"] },
  {
    key: "admissions",
    label: "Admissions",
    department: "Administration",
    actions: ["view", "create", "edit", "delete", "approve", "verify", "convert", "collect", "cancel", "refund", "export", "reports"],
  },
  { key: "teachers", label: "Teachers", department: "Academic", actions: ["view", "create", "edit", "delete", "assign"] },
  { key: "staff", label: "Staff", department: "HR", actions: ["view", "create", "edit", "delete"] },
  { key: "parents", label: "Parents", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "classes", label: "Classes", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "sections", label: "Sections", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "subjects", label: "Subjects", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "attendance", label: "Attendance", department: "Academic", actions: ["view", "create", "edit", "delete", "reports", "export"] },
  { key: "teacherAttendance", label: "Teacher Attendance", department: "HR", actions: ["view", "create", "edit", "delete"] },
  { key: "timetable", label: "Timetable", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "homework", label: "Homework", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "exams", label: "Examinations", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "examSchedules", label: "Exam Schedules", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "marks", label: "Marks", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "results", label: "Results", department: "Academic", actions: ["view", "create", "edit", "delete"] },
  { key: "fees", label: "Fees", department: "Finance", actions: ["view", "create", "edit", "delete", "collect"] },
  { key: "payments", label: "Payments", department: "Finance", actions: ["view", "create", "edit", "delete"] },
  { key: "expenses", label: "Expenses", department: "Finance", actions: ["view", "create", "edit", "delete"] },
  { key: "payroll", label: "Payroll", department: "HR", actions: ["view", "create", "edit", "delete"] },
  { key: "leave", label: "Leave", department: "HR", actions: ["view", "create", "edit", "delete"] },
  { key: "library", label: "Library", department: "Library", actions: ["view", "create", "edit", "delete", "issue", "return", "reports"] },
  { key: "transport", label: "Transport", department: "Transport", actions: ["view", "create", "edit", "delete", "assign", "reports"] },
  { key: "inventory", label: "Inventory", department: "Inventory", actions: ["view", "create", "edit", "delete"] },
  { key: "notices", label: "Notices", department: "Communication", actions: ["view", "create", "edit", "delete"] },
  { key: "notifications", label: "Notifications", department: "Communication", actions: ["view", "create", "edit", "delete"] },
  { key: "documents", label: "Documents", department: "Administration", actions: ["view", "create", "edit", "delete"] },
  { key: "users", label: "Users", department: "Administration", actions: ["view", "create", "edit", "delete"] },
  { key: "roles", label: "Roles", department: "Administration", actions: ["view", "create", "edit", "delete"] },
  { key: "reports", label: "Reports", department: "Administration", actions: ["view", "export"] },
  { key: "settings", label: "Settings", department: "Administration", actions: ["view", "edit"] },
  { key: "tickets", label: "Help & Support", department: "Administration", actions: ["view", "create", "edit"] },
  { key: "profile", label: "Profile", actions: ["view"] },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((mod) =>
  mod.actions.map((action) => `${mod.key}.${action}`),
);

export function permissionKey(module: string, action: string) {
  return `${module}.${action}`;
}

export const WORKSPACE_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS];

export const DEFAULT_ROLE_DEFINITIONS: Array<{
  name: string;
  slug: string;
  department: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}> = [
  {
    name: "Workspace Admin",
    slug: "workspace_admin",
    department: "Administration",
    description: "Full workspace access",
    isSystem: true,
    permissions: WORKSPACE_ADMIN_PERMISSIONS,
  },
  {
    name: "Teacher",
    slug: "teacher",
    department: "Academic",
    description: "Classroom teaching operations",
    isSystem: true,
    permissions: [
      "students.view",
      "classes.view",
      "sections.view",
      "subjects.view",
      "attendance.view",
      "attendance.create",
      "attendance.edit",
      "homework.view",
      "homework.create",
      "homework.edit",
      "exams.view",
      "exams.create",
      "exams.edit",
      "marks.view",
      "marks.create",
      "marks.edit",
      "timetable.view",
      "teachers.view",
      "leave.view",
      "leave.create",
      "payroll.view",
      "profile.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
      "notices.view",
      "notifications.view",
    ],
  },
  {
    name: "Accountant",
    slug: "accountant",
    department: "Finance",
    description: "Manages school financial operations",
    isSystem: true,
    permissions: [
      "fees.view",
      "fees.create",
      "fees.edit",
      "fees.collect",
      "payments.view",
      "payments.create",
      "payments.edit",
      "expenses.view",
      "expenses.create",
      "reports.view",
      "reports.export",
      "profile.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
  {
    name: "HR Manager",
    slug: "hr_manager",
    department: "HR",
    description: "Staff, leave and payroll operations",
    isSystem: true,
    permissions: [
      "staff.view",
      "staff.create",
      "staff.edit",
      "teachers.view",
      "attendance.view",
      "teacherAttendance.view",
      "teacherAttendance.create",
      "leave.view",
      "leave.create",
      "leave.edit",
      "leave.delete",
      "payroll.view",
      "payroll.create",
      "payroll.edit",
      "profile.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
  {
    name: "Librarian",
    slug: "librarian",
    department: "Library",
    description: "Library inventory and circulation",
    isSystem: true,
    permissions: [
      "library.view",
      "library.create",
      "library.edit",
      "library.issue",
      "library.return",
      "library.reports",
      "profile.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
  {
    name: "Transport Manager",
    slug: "transport_manager",
    department: "Transport",
    description: "Routes, vehicles and assignments",
    isSystem: true,
    permissions: [
      "transport.view",
      "transport.create",
      "transport.edit",
      "transport.assign",
      "transport.reports",
      "profile.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
  {
    name: "Student",
    slug: "student",
    department: "Academic",
    description: "Read-only access to own academic information",
    isSystem: true,
    permissions: [
      "profile.view",
      "students.view",
      "timetable.view",
      "homework.view",
      "attendance.view",
      "exams.view",
      "results.view",
      "notices.view",
      "notifications.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
  {
    name: "Parent",
    slug: "parent",
    department: "Academic",
    description: "Read-only access to linked children",
    isSystem: true,
    permissions: [
      "profile.view",
      "students.view",
      "attendance.view",
      "homework.view",
      "fees.view",
      "payments.view",
      "exams.view",
      "marks.view",
      "results.view",
      "timetable.view",
      "notices.view",
      "notifications.view",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
    ],
  },
];

export const CUSTOM_ROLE_EXAMPLES = [
  "Admission Manager",
  "Front Office",
  "IT Administrator",
  "Transport Coordinator",
  "Exam Coordinator",
  "Academic Coordinator",
  "Principal",
  "Vice Principal",
  "Counsellor",
  "HR Executive",
  "Finance Manager",
  "Security Manager",
  "Inventory Manager",
  "Lab Assistant",
  "Receptionist",
];
