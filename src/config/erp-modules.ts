export type ErpModuleCategory =
  | "academic"
  | "finance"
  | "administration"
  | "communication"
  | "services";

export type ErpModuleStatus = "available" | "coming_soon";

export type ErpModuleDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  category: ErpModuleCategory;
  displayOrder: number;
  isCore: boolean;
  permissions: string[];
  dependencies: string[];
  resourceKeys: string[];
  navHrefs: string[];
  status: ErpModuleStatus;
  defaultEnabled: boolean;
  accent: string;
};

export const ERP_MODULES: ErpModuleDefinition[] = [
  {
    id: "admissions",
    name: "Admissions",
    description: "Manage student admissions and enrolment",
    icon: "👤+",
    route: "/modules/admissions",
    category: "administration",
    displayOrder: 1,
    isCore: false,
    permissions: ["admissions.view"],
    dependencies: ["student-info"],
    resourceKeys: [],
    navHrefs: ["/modules/admissions", "/settings/admission"],
    status: "available",
    defaultEnabled: true,
    accent: "#dbeafe",
  },
  {
    id: "student-info",
    name: "Student Info",
    description: "Student records, classes, sections and parents",
    icon: "🎓",
    route: "/modules/student-info",
    category: "academic",
    displayOrder: 2,
    isCore: true,
    permissions: ["students.view", "parents.view", "classes.view"],
    dependencies: [],
    resourceKeys: ["students", "parents", "classes", "sections", "subjects", "academicSessions"],
    navHrefs: [
      "/modules/student-info",
      "/modules/student-info/students",
      "/modules/student-info/parents",
      "/modules/student-info/classes",
      "/modules/student-info/sections",
      "/modules/student-info/subjects",
      "/settings/student-info",
    ],
    status: "available",
    defaultEnabled: true,
    accent: "#e0e7ff",
  },
  {
    id: "teacher",
    name: "Teacher",
    description: "Teacher records, assignments and academic activities",
    icon: "👩‍🏫",
    route: "/modules/teacher",
    category: "academic",
    displayOrder: 3.5,
    isCore: true,
    permissions: ["teachers.view"],
    dependencies: ["student-info"],
    resourceKeys: ["teachers"],
    navHrefs: ["/modules/teacher", "/modules/teacher/teachers", "/modules/teacher/timetable", "/modules/teacher/attendance"],
    status: "available",
    defaultEnabled: true,
    accent: "#fef3c7",
  },
  {
    id: "attendance",
    name: "Attendance",
    description: "Track daily student and staff attendance",
    icon: "📋",
    route: "/modules/attendance",
    category: "academic",
    displayOrder: 3,
    isCore: true,
    permissions: ["attendance.view"],
    dependencies: ["student-info"],
    resourceKeys: ["attendance", "teacherAttendance"],
    navHrefs: ["/modules/attendance", "/modules/attendance/mark", "/modules/attendance/register", "/modules/attendance/reports", "/modules/attendance/settings"],
    status: "available",
    defaultEnabled: true,
    accent: "#dcfce7",
  },
  {
    id: "online-fees",
    name: "Online Fees",
    description: "Fee structures, billing and online payments",
    icon: "💳",
    route: "/finance/fees",
    category: "finance",
    displayOrder: 4,
    isCore: false,
    permissions: ["fees.view", "payments.view"],
    dependencies: ["student-info"],
    resourceKeys: ["fees", "feeStructures", "payments"],
    navHrefs: ["/finance/fees", "/finance/payments"],
    status: "available",
    defaultEnabled: true,
    accent: "#fef3c7",
  },
  {
    id: "examination",
    name: "Examination",
    description: "Exams, schedules and marks entry",
    icon: "📝",
    route: "/modules/exams",
    category: "academic",
    displayOrder: 5,
    isCore: false,
    permissions: ["exams.view", "marks.view"],
    dependencies: ["student-info"],
    resourceKeys: ["exams", "examSchedules", "marks"],
    navHrefs: ["/modules/exams", "/modules/marks"],
    status: "available",
    defaultEnabled: true,
    accent: "#fce7f3",
  },
  {
    id: "report-cards",
    name: "Report Cards",
    description: "Generate and publish student report cards",
    icon: "📊",
    route: "/modules/results",
    category: "academic",
    displayOrder: 6,
    isCore: false,
    permissions: ["results.view"],
    dependencies: ["examination"],
    resourceKeys: ["results"],
    navHrefs: ["/modules/results"],
    status: "available",
    defaultEnabled: true,
    accent: "#f3e8ff",
  },
  {
    id: "homework",
    name: "Homework",
    description: "Assign and review student homework",
    icon: "📚",
    route: "/modules/homework",
    category: "academic",
    displayOrder: 7,
    isCore: false,
    permissions: ["homework.view"],
    dependencies: ["student-info"],
    resourceKeys: ["homework"],
    navHrefs: ["/modules/homework"],
    status: "available",
    defaultEnabled: true,
    accent: "#ffedd5",
  },
  {
    id: "transport",
    name: "Transport",
    description: "Routes, vehicles and student transport",
    icon: "🚌",
    route: "/modules/transport",
    category: "administration",
    displayOrder: 8,
    isCore: false,
    permissions: ["transport.view"],
    dependencies: ["student-info"],
    resourceKeys: ["transport", "routes", "transportAssignments"],
    navHrefs: ["/modules/transport"],
    status: "available",
    defaultEnabled: true,
    accent: "#cffafe",
  },
  {
    id: "timetable",
    name: "Time Table",
    description: "Class schedules and period planning",
    icon: "🗓",
    route: "/modules/timetable",
    category: "academic",
    displayOrder: 9,
    isCore: false,
    permissions: ["timetable.view"],
    dependencies: ["student-info"],
    resourceKeys: ["timetable"],
    navHrefs: ["/modules/timetable"],
    status: "available",
    defaultEnabled: true,
    accent: "#e0f2fe",
  },
  {
    id: "library",
    name: "Library",
    description: "Books catalogue and issue management",
    icon: "📖",
    route: "/modules/library",
    category: "services",
    displayOrder: 10,
    isCore: false,
    permissions: ["library.view"],
    dependencies: ["student-info"],
    resourceKeys: ["library", "bookIssues"],
    navHrefs: ["/modules/library", "/modules/bookIssues"],
    status: "available",
    defaultEnabled: true,
    accent: "#ede9fe",
  },
  {
    id: "accounts",
    name: "Accounts",
    description: "Expenses and financial accounts",
    icon: "🧾",
    route: "/finance/expenses",
    category: "finance",
    displayOrder: 11,
    isCore: false,
    permissions: ["expenses.view"],
    dependencies: [],
    resourceKeys: ["expenses"],
    navHrefs: ["/finance/expenses"],
    status: "available",
    defaultEnabled: true,
    accent: "#fef9c3",
  },
  {
    id: "payroll",
    name: "Payroll",
    description: "Salary structures and payroll processing",
    icon: "💰",
    route: "/finance/payroll",
    category: "finance",
    displayOrder: 12,
    isCore: false,
    permissions: ["payroll.view"],
    dependencies: ["hr-staff"],
    resourceKeys: ["payroll", "salaryStructures"],
    navHrefs: ["/finance/payroll"],
    status: "available",
    defaultEnabled: true,
    accent: "#d1fae5",
  },
  {
    id: "hr-staff",
    name: "HR & Staff",
    description: "Teachers, staff records and leave",
    icon: "👥",
    route: "/settings/staff",
    category: "administration",
    displayOrder: 13,
    isCore: false,
    permissions: ["staff.view", "teachers.view", "leave.view"],
    dependencies: [],
    resourceKeys: ["staff", "teachers", "leave", "leaveTypes"],
    navHrefs: ["/modules/teacher", "/settings/staff", "/modules/leave"],
    status: "available",
    defaultEnabled: true,
    accent: "#fae8ff",
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Stock items and inventory transactions",
    icon: "📦",
    route: "/modules/inventory",
    category: "administration",
    displayOrder: 14,
    isCore: false,
    permissions: ["inventory.view"],
    dependencies: [],
    resourceKeys: ["inventory", "inventoryTransactions"],
    navHrefs: ["/modules/inventory"],
    status: "available",
    defaultEnabled: true,
    accent: "#f5f5f4",
  },
  {
    id: "comms-center",
    name: "Comms Center",
    description: "Notices and school communications",
    icon: "📢",
    route: "/modules/notices",
    category: "communication",
    displayOrder: 15,
    isCore: false,
    permissions: ["notices.view"],
    dependencies: [],
    resourceKeys: ["notices", "notifications"],
    navHrefs: ["/modules/notices"],
    status: "available",
    defaultEnabled: true,
    accent: "#fee2e2",
  },
  {
    id: "mobile-app",
    name: "Mobile App",
    description: "Mobile app access and configuration",
    icon: "📱",
    route: "",
    category: "services",
    displayOrder: 16,
    isCore: false,
    permissions: [],
    dependencies: [],
    resourceKeys: [],
    navHrefs: [],
    status: "coming_soon",
    defaultEnabled: true,
    accent: "#e2e8f0",
  },
];

export const LEGACY_DEFAULT_ENABLED_MODULE_IDS = [
  "admissions",
  "student-info",
  "teacher",
  "attendance",
  "online-fees",
  "examination",
  "report-cards",
  "homework",
  "hr-staff",
  "comms-center",
] as const;

export function getAllAvailableModuleIds() {
  return ERP_MODULES.filter((module) => module.status === "available").map((module) => module.id);
}

export function getDefaultEnabledModuleIds() {
  return getAllAvailableModuleIds();
}

export const ERP_MODULE_MAP = Object.fromEntries(ERP_MODULES.map((module) => [module.id, module])) as Record<
  string,
  ErpModuleDefinition
>;

export const ERP_MODULE_IDS = ERP_MODULES.map((module) => module.id);

export const RESOURCE_TO_MODULE: Record<string, string> = ERP_MODULES.reduce(
  (acc, module) => {
    for (const key of module.resourceKeys) {
      acc[key] = module.id;
    }
    return acc;
  },
  {} as Record<string, string>,
);

export const NAV_HREF_TO_MODULE: Record<string, string> = ERP_MODULES.reduce(
  (acc, module) => {
    for (const href of module.navHrefs) {
      acc[href] = module.id;
    }
    return acc;
  },
  {} as Record<string, string>,
);
