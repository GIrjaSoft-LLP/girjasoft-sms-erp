export const STUDENT_EXCEL_HEADERS = [
  "admissionNumber",
  "name",
  "gender",
  "dateOfBirth",
  "phone",
  "email",
  "address",
  "status",
];

export const USER_EXCEL_HEADERS = [
  "name",
  "email",
  "phone",
  "username",
  "department",
  "employeeId",
  "role",
  "status",
];

export const EXCEL_MODULES = [
  "students",
  "parents",
  "teachers",
  "staff",
  "classes",
  "sections",
  "subjects",
  "attendance",
  "timetable",
  "marks",
  "results",
  "fees",
  "payments",
  "expenses",
  "payroll",
  "library",
  "bookIssues",
  "inventory",
] as const;

export type ExcelModule = (typeof EXCEL_MODULES)[number];

export const EXCEL_UNIQUE_KEYS: Record<string, string[]> = {
  students: ["admissionNumber"],
  parents: ["email"],
  teachers: ["employeeId"],
  staff: ["employeeId"],
  classes: ["name"],
  sections: ["classId", "name"],
  subjects: ["classId", "code"],
  attendance: ["studentId", "date"],
  timetable: ["classId", "day", "period"],
  marks: ["examId", "studentId", "subjectId"],
  results: ["examId", "studentId"],
  fees: ["studentId", "dueDate", "amount"],
  payments: ["receiptNumber"],
  expenses: ["title", "date", "amount"],
  payroll: ["employeeId", "month"],
  library: ["isbn"],
  bookIssues: ["bookId", "studentId", "issueDate"],
  inventory: ["sku"],
};

export function isExcelModule(key: string): key is ExcelModule {
  return (EXCEL_MODULES as readonly string[]).includes(key);
}
