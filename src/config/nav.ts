export type NavLink = {
  href: string;
  label: string;
  permission: string;
  exact?: boolean;
};

export type NavItem = NavLink & {
  anyOf?: string[];
  children?: NavLink[];
};

export const FINANCE_NAV: NavLink[] = [
  { href: "/finance/fees", label: "Fees", permission: "fees.view" },
  { href: "/finance/payments", label: "Payments", permission: "payments.view" },
  { href: "/finance/expenses", label: "Expenses", permission: "expenses.view" },
  { href: "/finance/payroll", label: "Payroll", permission: "payroll.view" },
];

export const SETTINGS_NAV: NavLink[] = [
  { href: "/settings", label: "Organization", permission: "settings.view", exact: true },
  { href: "/settings/users", label: "Users", permission: "users.view" },
  { href: "/settings/staff", label: "Staff", permission: "staff.view" },
  { href: "/settings/roles", label: "Roles", permission: "roles.view" },
  { href: "/settings/admission", label: "Admission", permission: "admissions.view" },
  { href: "/settings/student-info", label: "Student Info", permission: "settings.view" },
  { href: "/settings/theme", label: "Theme", permission: "settings.view" },
];

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "ERP Modules", permission: "profile.view", exact: true },
  { href: "/modules/admissions", label: "Admissions", permission: "admissions.view" },
  {
    href: "/modules/student-info",
    label: "Student Info",
    permission: "students.view",
    anyOf: ["students.view", "parents.view", "classes.view"],
  },
  { href: "/modules/teachers", label: "Teachers", permission: "teachers.view" },
  { href: "/modules/attendance", label: "Attendance", permission: "attendance.view" },
  { href: "/modules/timetable", label: "Timetable", permission: "timetable.view" },
  { href: "/modules/homework", label: "Homework", permission: "homework.view" },
  { href: "/modules/exams", label: "Exams", permission: "exams.view" },
  { href: "/modules/marks", label: "Marks", permission: "marks.view" },
  { href: "/modules/results", label: "Results", permission: "results.view" },
  { href: "/modules/leave", label: "Leave", permission: "leave.view" },
  { href: "/modules/library", label: "Library", permission: "library.view" },
  { href: "/modules/bookIssues", label: "Book Issues", permission: "library.view" },
  { href: "/modules/transport", label: "Transport", permission: "transport.view" },
  { href: "/modules/inventory", label: "Inventory", permission: "inventory.view" },
  {
    href: "/finance",
    label: "Finance",
    permission: "fees.view",
    anyOf: FINANCE_NAV.map((item) => item.permission),
    children: FINANCE_NAV,
  },
  {
    href: "/settings",
    label: "Settings",
    permission: "settings.view",
    anyOf: SETTINGS_NAV.map((item) => item.permission),
  },
];

export const PLATFORM_NAV = [
  { href: "/platform/workspaces/new", label: "Create Workspace", permission: "platform.workspaces.create" },
  { href: "/platform/users", label: "Workspace Users", permission: "platform.workspaceUsers.view" },
  { href: "/platform/tickets", label: "Tickets", permission: "platform.tickets.view" },
  { href: "/platform/audit", label: "Audit Logs", permission: "platform.audit.view" },
];

export const PLATFORM_SETTINGS_NAV = [
  { href: "/platform/settings", label: "General", permission: "platform.settings.view", exact: true },
  { href: "/platform/settings/roles", label: "Roles", permission: "platform.roles.view" },
  { href: "/platform/settings/users", label: "Users", permission: "platform.users.view" },
];

export const FINANCE_RESOURCES = ["fees", "payments", "expenses", "payroll"] as const;
export type FinanceResource = (typeof FINANCE_RESOURCES)[number];

export function isFinanceResource(value: string): value is FinanceResource {
  return FINANCE_RESOURCES.includes(value as FinanceResource);
}
