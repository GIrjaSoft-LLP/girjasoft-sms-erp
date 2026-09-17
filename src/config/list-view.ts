export type ListFilter = "classId" | "sectionId" | "status" | "date" | "day";

type PopulateSpec = {
  path: string;
  select: string;
  populate?: Array<{ path: string; select: string }>;
};

export const RESOURCE_POPULATE: Record<string, PopulateSpec[]> = {
  students: [
    { path: "classId", select: "name" },
    { path: "sectionId", select: "name" },
  ],
  sections: [{ path: "classId", select: "name numericName" }],
  subjects: [{ path: "classId", select: "name numericName" }],
  attendance: [
    { path: "studentId", select: "name admissionNumber" },
    { path: "classId", select: "name" },
    { path: "sectionId", select: "name" },
  ],
  teacherAttendance: [{ path: "teacherId", select: "name employeeId" }],
  timetable: [
    { path: "classId", select: "name" },
    { path: "sectionId", select: "name" },
    { path: "subjectId", select: "name" },
    { path: "teacherId", select: "name" },
  ],
  homework: [
    { path: "classId", select: "name" },
    { path: "sectionId", select: "name" },
    { path: "subjectId", select: "name" },
    { path: "teacherId", select: "name" },
  ],
  exams: [{ path: "classId", select: "name" }],
  examSchedules: [
    { path: "examId", select: "name" },
    { path: "subjectId", select: "name" },
    { path: "classId", select: "name" },
  ],
  marks: [
    { path: "examId", select: "name" },
    {
      path: "studentId",
      select: "name admissionNumber classId sectionId",
      populate: [
        { path: "classId", select: "name" },
        { path: "sectionId", select: "name" },
      ],
    },
    { path: "subjectId", select: "name" },
  ],
  results: [
    { path: "examId", select: "name" },
    {
      path: "studentId",
      select: "name admissionNumber classId sectionId",
      populate: [
        { path: "classId", select: "name" },
        { path: "sectionId", select: "name" },
      ],
    },
  ],
  fees: [
    {
      path: "studentId",
      select: "name admissionNumber classId sectionId",
      populate: [
        { path: "classId", select: "name" },
        { path: "sectionId", select: "name" },
      ],
    },
    { path: "feeStructureId", select: "name" },
  ],
  feeStructures: [{ path: "classId", select: "name" }],
  payments: [
    {
      path: "studentId",
      select: "name admissionNumber classId sectionId",
      populate: [
        { path: "classId", select: "name" },
        { path: "sectionId", select: "name" },
      ],
    },
    { path: "studentFeeId", select: "feeStructureId amount", populate: [{ path: "feeStructureId", select: "name" }] },
  ],
  bookIssues: [
    { path: "bookId", select: "title" },
    {
      path: "studentId",
      select: "name admissionNumber classId sectionId",
      populate: [
        { path: "classId", select: "name" },
        { path: "sectionId", select: "name" },
      ],
    },
  ],
  transportAssignments: [
    { path: "studentId", select: "name admissionNumber" },
    { path: "routeId", select: "name" },
    { path: "vehicleId", select: "number" },
  ],
  routes: [{ path: "vehicleId", select: "number" }],
  leave: [{ path: "leaveTypeId", select: "name" }],
  salaryStructures: [
    { path: "teacherId", select: "name employeeId" },
    { path: "staffId", select: "name employeeId" },
  ],
  inventoryTransactions: [{ path: "itemId", select: "name sku" }],
};

export const RESOURCE_FILTERS: Record<string, ListFilter[]> = {
  students: ["classId", "sectionId", "status"],
  parents: ["status"],
  teachers: ["status"],
  staff: ["status"],
  classes: ["status"],
  sections: ["classId"],
  subjects: ["classId"],
  attendance: ["classId", "sectionId", "status", "date"],
  teacherAttendance: ["status", "date"],
  timetable: ["classId", "sectionId", "day"],
  homework: ["classId", "sectionId"],
  exams: ["status"],
  examSchedules: ["classId", "date"],
  marks: ["classId", "sectionId"],
  results: ["classId", "sectionId", "status"],
  fees: ["classId", "sectionId", "status"],
  payments: ["classId", "sectionId", "date", "status"],
  expenses: ["date"],
  payroll: ["status"],
  leave: ["status"],
  library: [],
  bookIssues: ["status"],
  notices: ["date"],
  transportAssignments: ["classId", "sectionId"],
};

export const FILTER_STATUS_OPTIONS: Record<string, string[]> = {
  students: ["ACTIVE", "INACTIVE"],
  parents: ["ACTIVE", "INACTIVE"],
  teachers: ["ACTIVE", "INACTIVE"],
  staff: ["ACTIVE", "INACTIVE"],
  classes: ["ACTIVE", "INACTIVE"],
  attendance: ["PRESENT", "ABSENT", "LATE", "LEAVE"],
  teacherAttendance: ["PRESENT", "ABSENT", "LATE", "LEAVE"],
  exams: ["DRAFT", "SCHEDULED", "ACTIVE", "ONGOING", "COMPLETED", "CANCELLED"],
  results: ["PASS", "FAIL"],
  fees: ["PENDING", "PARTIAL", "PAID"],
  payments: ["PENDING_VERIFICATION", "CONFIRMED", "REJECTED"],
  payroll: ["DRAFT", "PAID"],
  leave: ["PENDING", "APPROVED", "REJECTED"],
  bookIssues: ["ISSUED", "RETURNED"],
};

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function labelFromRef(value: unknown, fallbackKeys: string[] = ["name"]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of fallbackKeys) {
    if (record[key]) return String(record[key]);
  }
  return "";
}

export function flattenListItem(item: Record<string, unknown>) {
  const student = item.studentId as Record<string, unknown> | undefined;
  const classRef = item.classId as Record<string, unknown> | undefined;
  const section = item.sectionId as Record<string, unknown> | undefined;
  const teacher = item.teacherId as Record<string, unknown> | undefined;
  const subject = item.subjectId as Record<string, unknown> | undefined;
  const exam = item.examId as Record<string, unknown> | undefined;
  const book = item.bookId as Record<string, unknown> | undefined;
  const feeStructure = item.feeStructureId as Record<string, unknown> | undefined;
  const studentFee = item.studentFeeId as Record<string, unknown> | undefined;
  const nestedFeeHead = studentFee?.feeStructureId as Record<string, unknown> | undefined;
  const leaveType = item.leaveTypeId as Record<string, unknown> | undefined;
  const route = item.routeId as Record<string, unknown> | undefined;
  const vehicle = item.vehicleId as Record<string, unknown> | undefined;
  const inventoryItem = item.itemId as Record<string, unknown> | undefined;
  const staff = item.staffId as Record<string, unknown> | undefined;
  const nestedClass = student?.classId as Record<string, unknown> | undefined;
  const nestedSection = student?.sectionId as Record<string, unknown> | undefined;

  return {
    ...item,
    studentId: student?._id ? String(student._id) : item.studentId,
    classId: classRef?._id ? String(classRef._id) : nestedClass?._id ? String(nestedClass._id) : item.classId,
    sectionId: section?._id ? String(section._id) : nestedSection?._id ? String(nestedSection._id) : item.sectionId,
    teacherId: teacher?._id ? String(teacher._id) : item.teacherId,
    staffId: staff?._id ? String(staff._id) : item.staffId,
    subjectId: subject?._id ? String(subject._id) : item.subjectId,
    examId: exam?._id ? String(exam._id) : item.examId,
    bookId: book?._id ? String(book._id) : item.bookId,
    feeStructureId: feeStructure?._id ? String(feeStructure._id) : item.feeStructureId,
    leaveTypeId: leaveType?._id ? String(leaveType._id) : item.leaveTypeId,
    routeId: route?._id ? String(route._id) : item.routeId,
    vehicleId: vehicle?._id ? String(vehicle._id) : item.vehicleId,
    itemId: inventoryItem?._id ? String(inventoryItem._id) : item.itemId,
    studentName: labelFromRef(student),
    admissionNumber: student?.admissionNumber ? String(student.admissionNumber) : item.admissionNumber,
    className: labelFromRef(classRef) || labelFromRef(nestedClass),
    classOrder: classRef?.numericName != null ? String(classRef.numericName) : "",
    sectionName: labelFromRef(section) || labelFromRef(nestedSection),
    teacherName: labelFromRef(teacher) || labelFromRef(staff),
    subjectName: labelFromRef(subject),
    examName: labelFromRef(exam),
    bookTitle: labelFromRef(book, ["title", "name"]),
    feeHead: labelFromRef(feeStructure) || labelFromRef(nestedFeeHead),
    studentFeeId: studentFee?._id ? String(studentFee._id) : item.studentFeeId,
    leaveTypeName: labelFromRef(leaveType),
    routeName: labelFromRef(route),
    vehicleNumber: labelFromRef(vehicle, ["number", "name"]),
    itemName: labelFromRef(inventoryItem),
  };
}
