export const STUDENT_EXCEL_HEADERS = [
  "Admission No",
  "Student Name",
  "Class",
  "Section",
  "Date Of Birth",
  "Gender",
  "Parent Name",
  "Relation",
  "Parent Mobile",
  "Parent Email ID",
  "Status",
  "Address",
  "Academic Session",
  "Current Roll No",
] as const;

export type StudentExcelHeader = (typeof STUDENT_EXCEL_HEADERS)[number];

export const STUDENT_EXCEL_SAMPLE: Record<StudentExcelHeader, string> = {
  "Admission No": "ADM-001",
  "Student Name": "Sample Student",
  "Class": "Class 1",
  "Section": "A",
  "Date Of Birth": "2012-04-15",
  "Gender": "Female",
  "Parent Name": "Sample Parent",
  "Relation": "Father",
  "Parent Mobile": "9999999999",
  "Parent Email ID": "parent@school.com",
  "Status": "ACTIVE",
  "Address": "City",
  "Academic Session": "2026-2027",
  "Current Roll No": "1",
};

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
