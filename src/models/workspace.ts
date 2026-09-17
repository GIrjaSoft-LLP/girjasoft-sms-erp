import mongoose, { Schema } from "mongoose";

function tenantFields() {
  return {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  };
}

const studentSchema = new Schema(
  {
    ...tenantFields(),
    admissionNumber: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    firstName: { type: String, default: "" },
    middleName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    gender: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    aadhaar: { type: String, default: "" },
    nationality: { type: String, default: "" },
    religion: { type: String, default: "" },
    category: { type: String, default: "" },
    motherTongue: { type: String, default: "" },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null, index: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Parent", default: null },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    emergencyContact: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" },
    photo: { type: String, default: "" },
    status: { type: String, default: "ACTIVE", index: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    currentEnrollmentId: { type: Schema.Types.ObjectId, ref: "StudentEnrollment", default: null },
  },
  { timestamps: true },
);
studentSchema.index({ workspaceId: 1, admissionNumber: 1 }, { unique: true });
studentSchema.index({ workspaceId: 1, classId: 1, sectionId: 1 });
studentSchema.index({ workspaceId: 1, name: 1 });

const parentSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    studentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    relation: { type: String, default: "Guardian" },
    address: { type: String, default: "" },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true },
);
parentSchema.index({ workspaceId: 1, email: 1 });
parentSchema.index({ workspaceId: 1, phone: 1 });

const teacherSchema = new Schema(
  {
    ...tenantFields(),
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    department: { type: String, default: "Academic" },
    designation: { type: String, default: "" },
    qualification: { type: String, default: "" },
    experience: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    subjects: [{ type: String }],
    photo: { type: String, default: "" },
    status: { type: String, default: "ACTIVE", index: true },
  },
  { timestamps: true },
);
teacherSchema.index({ workspaceId: 1, employeeId: 1 }, { unique: true });
teacherSchema.index({ workspaceId: 1, email: 1 });

const teacherClassAssignmentSchema = new Schema(
  {
    ...tenantFields(),
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true, index: true },
    status: { type: String, default: "ACTIVE", index: true },
  },
  { timestamps: true },
);
teacherClassAssignmentSchema.index({ workspaceId: 1, teacherId: 1, classId: 1 }, { unique: true });

const staffSchema = new Schema(
  {
    ...tenantFields(),
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    staffType: { type: String, default: "", index: true },
    qualification: { type: String, default: "" },
    experience: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    linkedTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    enablePortalLogin: { type: Boolean, default: false },
    status: { type: String, default: "ACTIVE", index: true },
  },
  { timestamps: true },
);
staffSchema.index({ workspaceId: 1, employeeId: 1 }, { unique: true });

const classSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    numericName: { type: Number, default: 0 },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true },
);
classSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const sectionSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    classTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    capacity: { type: Number, default: 40 },
  },
  { timestamps: true },
);
sectionSchema.index({ workspaceId: 1, classId: 1, name: 1 }, { unique: true });
sectionSchema.index({ workspaceId: 1, classId: 1 });

const subjectSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    code: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true },
  },
  { timestamps: true },
);
subjectSchema.index({ workspaceId: 1, classId: 1, code: 1 }, { unique: true });
subjectSchema.index({ workspaceId: 1, classId: 1, name: 1 }, { unique: true });

const academicSessionSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true },
);
academicSessionSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
academicSessionSchema.index({ workspaceId: 1, isCurrent: 1 });

const studentEnrollmentSchema = new Schema(
  {
    ...tenantFields(),
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    rollNumber: { type: String, default: "" },
    promotionStatus: {
      type: String,
      enum: ["ENROLLED", "PENDING", "PROMOTED", "NOT_PROMOTED", "TRANSFERRED", "GRADUATED", "ARCHIVED"],
      default: "ENROLLED",
      index: true,
    },
    isCurrent: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "WITHDRAWN"], default: "ACTIVE" },
  },
  { timestamps: true },
);
studentEnrollmentSchema.index({ workspaceId: 1, studentId: 1, academicSessionId: 1 }, { unique: true });
studentEnrollmentSchema.index({ workspaceId: 1, studentId: 1, isCurrent: 1 });
studentEnrollmentSchema.index({ workspaceId: 1, academicSessionId: 1, classId: 1, sectionId: 1 });

const enrollmentAuditSchema = new Schema(
  {
    ...tenantFields(),
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "StudentEnrollment", default: null },
    action: { type: String, required: true },
    oldAcademicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    newAcademicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    oldClassId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    newClassId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    oldSectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    newSectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    oldRollNumber: { type: String, default: "" },
    newRollNumber: { type: String, default: "" },
    oldPromotionStatus: { type: String, default: "" },
    newPromotionStatus: { type: String, default: "" },
    reason: { type: String, default: "" },
    changedBy: { type: String, default: "" },
    changedByEmail: { type: String, default: "" },
  },
  { timestamps: true },
);
enrollmentAuditSchema.index({ workspaceId: 1, studentId: 1, createdAt: -1 });

const attendanceSchema = new Schema(
  {
    ...tenantFields(),
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession", default: null, index: true },
    date: { type: String, required: true },
    attendanceType: { type: String, enum: ["CLASS", "SUBJECT"], default: "CLASS", index: true },
    status: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "LEAVE"], required: true },
    remarks: { type: String, default: "" },
    markedBy: { type: String, default: "" },
    markedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
attendanceSchema.index({ workspaceId: 1, date: 1 });
attendanceSchema.index(
  { workspaceId: 1, studentId: 1, date: 1, attendanceType: 1, subjectId: 1 },
  { unique: true },
);
attendanceSchema.index({ workspaceId: 1, classId: 1, sectionId: 1, date: 1 });
attendanceSchema.index({ workspaceId: 1, subjectId: 1, date: 1 });

const attendanceSessionSchema = new Schema(
  {
    ...tenantFields(),
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    date: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    attendanceType: { type: String, enum: ["CLASS", "SUBJECT"], default: "CLASS" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    status: { type: String, enum: ["DRAFT", "SUBMITTED"], default: "SUBMITTED" },
    markedBy: { type: String, default: "" },
    markedByEmail: { type: String, default: "" },
    markedAt: { type: Date, default: null },
    totalStudents: { type: Number, default: 0 },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    leaveCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
attendanceSessionSchema.index(
  { workspaceId: 1, academicSessionId: 1, date: 1, classId: 1, sectionId: 1, attendanceType: 1, subjectId: 1 },
  { unique: true },
);
attendanceSessionSchema.index({ workspaceId: 1, date: 1 });

const attendanceAuditSchema = new Schema(
  {
    ...tenantFields(),
    attendanceId: { type: Schema.Types.ObjectId, ref: "Attendance", default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession", default: null },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    previousStatus: { type: String, default: "" },
    newStatus: { type: String, default: "" },
    reason: { type: String, default: "" },
    changedBy: { type: String, default: "" },
    changedByEmail: { type: String, default: "" },
  },
  { timestamps: true },
);
attendanceAuditSchema.index({ workspaceId: 1, sessionId: 1 });
attendanceAuditSchema.index({ workspaceId: 1, studentId: 1 });

const teacherAttendanceSchema = new Schema(
  {
    ...tenantFields(),
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ["PRESENT", "ABSENT", "LATE", "LEAVE"], required: true },
  },
  { timestamps: true },
);
teacherAttendanceSchema.index({ workspaceId: 1, teacherId: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ workspaceId: 1, date: 1 });

const timetableSchema = new Schema(
  {
    ...tenantFields(),
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    day: { type: String, required: true },
    period: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { timestamps: true },
);
timetableSchema.index({ workspaceId: 1, classId: 1, sectionId: 1, day: 1 });

const homeworkSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    description: { type: String, default: "" },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    dueDate: { type: String, default: "" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { timestamps: true },
);
homeworkSchema.index({ workspaceId: 1, classId: 1, sectionId: 1 });

const examSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    academicSessionId: { type: Schema.Types.ObjectId, default: null },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    status: { type: String, default: "DRAFT" },
  },
  { timestamps: true },
);
examSchema.index({ workspaceId: 1, academicSessionId: 1 });
examSchema.index({ workspaceId: 1, classId: 1 });

const examScheduleSchema = new Schema(
  {
    ...tenantFields(),
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    date: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    maxMarks: { type: Number, default: 100 },
  },
  { timestamps: true },
);
examScheduleSchema.index({ workspaceId: 1, examId: 1 });

const markSchema = new Schema(
  {
    ...tenantFields(),
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    marksObtained: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 100 },
    grade: { type: String, default: "" },
  },
  { timestamps: true },
);
markSchema.index({ workspaceId: 1, examId: 1, studentId: 1, subjectId: 1 }, { unique: true });

const resultSchema = new Schema(
  {
    ...tenantFields(),
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    totalMarks: { type: Number, default: 0 },
    gainedMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    grade: { type: String, default: "" },
    status: { type: String, default: "PASS" },
  },
  { timestamps: true },
);
resultSchema.index({ workspaceId: 1, examId: 1, studentId: 1 }, { unique: true });

const feeStructureSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    amount: { type: Number, required: true },
    frequency: { type: String, default: "MONTHLY" },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
  },
  { timestamps: true },
);
feeStructureSchema.index({ workspaceId: 1, name: 1, classId: 1 });

const studentFeeSchema = new Schema(
  {
    ...tenantFields(),
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    feeStructureId: { type: Schema.Types.ObjectId, ref: "FeeStructure", default: null },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    status: { type: String, enum: ["PENDING", "PARTIAL", "PAID"], default: "PENDING", index: true },
    paidAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
studentFeeSchema.index({ workspaceId: 1, studentId: 1, status: 1 });

const feePaymentSchema = new Schema(
  {
    ...tenantFields(),
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentFeeId: { type: Schema.Types.ObjectId, ref: "StudentFee", default: null },
    amount: { type: Number, required: true },
    method: { type: String, default: "CASH" },
    receiptNumber: { type: String, required: true },
    date: { type: String, required: true },
    remarks: { type: String, default: "" },
    verificationStatus: {
      type: String,
      enum: ["PENDING_VERIFICATION", "CONFIRMED", "REJECTED"],
      default: "CONFIRMED",
      index: true,
    },
    source: { type: String, enum: ["ADMIN", "PARENT_RECEIPT", "GATEWAY"], default: "ADMIN" },
    transactionRef: { type: String, default: "" },
    receiptFile: {
      name: { type: String, default: "" },
      url: { type: String, default: "" },
      size: { type: Number, default: 0 },
      mime: { type: String, default: "" },
    },
    submittedBy: { type: Schema.Types.ObjectId, default: null },
    submittedByName: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    appliedToFee: { type: Boolean, default: false },
  },
  { timestamps: true },
);
feePaymentSchema.index({ workspaceId: 1, receiptNumber: 1 }, { unique: true });
feePaymentSchema.index({ workspaceId: 1, studentId: 1, date: 1 });
feePaymentSchema.index({ workspaceId: 1, studentFeeId: 1, verificationStatus: 1 });

const expenseSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    category: { type: String, default: "General" },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);
expenseSchema.index({ workspaceId: 1, date: 1 });

const salaryStructureSchema = new Schema(
  {
    ...tenantFields(),
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    basic: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
  },
  { timestamps: true },
);
salaryStructureSchema.index({ workspaceId: 1, staffId: 1 });

const payrollSchema = new Schema(
  {
    ...tenantFields(),
    staffName: { type: String, required: true },
    employeeId: { type: String, default: "" },
    month: { type: String, required: true },
    basic: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, required: true },
    status: { type: String, default: "DRAFT" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
  },
  { timestamps: true },
);
payrollSchema.index({ workspaceId: 1, month: 1, employeeId: 1 });

const leaveTypeSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    code: { type: String, default: "" },
    days: { type: Number, default: 0 },
  },
  { timestamps: true },
);
leaveTypeSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const leaveRequestSchema = new Schema(
  {
    ...tenantFields(),
    requesterName: { type: String, required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: "LeaveType", default: null },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    reason: { type: String, default: "" },
    status: { type: String, default: "PENDING", index: true },
  },
  { timestamps: true },
);
leaveRequestSchema.index({ workspaceId: 1, status: 1 });
leaveRequestSchema.index({ workspaceId: 1, teacherId: 1, fromDate: 1 });

const publicHolidaySchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true },
);
publicHolidaySchema.index({ workspaceId: 1, date: 1 }, { unique: true });

const bookSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    author: { type: String, default: "" },
    isbn: { type: String, default: "" },
    copies: { type: Number, default: 1 },
    available: { type: Number, default: 1 },
  },
  { timestamps: true },
);
bookSchema.index({ workspaceId: 1, isbn: 1 });

const bookIssueSchema = new Schema(
  {
    ...tenantFields(),
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    issueDate: { type: String, required: true },
    dueDate: { type: String, default: "" },
    returnDate: { type: String, default: "" },
    status: { type: String, default: "ISSUED", index: true },
  },
  { timestamps: true },
);
bookIssueSchema.index({ workspaceId: 1, bookId: 1, status: 1 });

const vehicleSchema = new Schema(
  {
    ...tenantFields(),
    number: { type: String, required: true },
    type: { type: String, default: "BUS" },
    capacity: { type: Number, default: 40 },
    driver: { type: String, default: "" },
  },
  { timestamps: true },
);
vehicleSchema.index({ workspaceId: 1, number: 1 }, { unique: true });

const routeSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    stops: { type: String, default: "" },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null },
  },
  { timestamps: true },
);
routeSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const transportAssignmentSchema = new Schema(
  {
    ...tenantFields(),
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "TransportRoute", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null },
    pickupPoint: { type: String, default: "" },
  },
  { timestamps: true },
);
transportAssignmentSchema.index({ workspaceId: 1, studentId: 1 }, { unique: true });

const inventoryItemSchema = new Schema(
  {
    ...tenantFields(),
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: "pcs" },
    location: { type: String, default: "" },
  },
  { timestamps: true },
);
inventoryItemSchema.index({ workspaceId: 1, sku: 1 }, { unique: true });

const inventoryTransactionSchema = new Schema(
  {
    ...tenantFields(),
    itemId: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    quantity: { type: Number, required: true },
    date: { type: String, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);
inventoryTransactionSchema.index({ workspaceId: 1, itemId: 1, date: 1 });

const noticeSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    body: { type: String, default: "" },
    audience: { type: String, default: "ALL" },
    date: { type: String, default: "" },
  },
  { timestamps: true },
);
noticeSchema.index({ workspaceId: 1, date: 1 });

const notificationSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    body: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);
notificationSchema.index({ workspaceId: 1, userId: 1 });

const documentSchema = new Schema(
  {
    ...tenantFields(),
    title: { type: String, required: true },
    category: { type: String, default: "General" },
    url: { type: String, default: "" },
  },
  { timestamps: true },
);

const auditLogSchema = new Schema(
  {
    ...tenantFields(),
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, default: "" },
    entityId: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
auditLogSchema.index({ workspaceId: 1, createdAt: -1 });
auditLogSchema.index({ workspaceId: 1, action: 1 });

const settingsSchema = new Schema(
  {
    ...tenantFields(),
    organization: { type: Schema.Types.Mixed, default: {} },
    academic: { type: Schema.Types.Mixed, default: {} },
    finance: { type: Schema.Types.Mixed, default: {} },
    attendance: { type: Schema.Types.Mixed, default: {} },
    examination: { type: Schema.Types.Mixed, default: {} },
    communication: { type: Schema.Types.Mixed, default: {} },
    theme: { type: Schema.Types.Mixed, default: {} },
    uiDesign: { type: Schema.Types.Mixed, default: {} },
    admission: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
settingsSchema.index({ workspaceId: 1 }, { unique: true });

function model(name: string, schema: Schema, collection: string) {
  return mongoose.models[name] || mongoose.model(name, schema, collection);
}

export const Student = model("Student", studentSchema, "students");
export const Parent = model("Parent", parentSchema, "parents");
export const Teacher = model("Teacher", teacherSchema, "teachers");
export const TeacherClassAssignment = model(
  "TeacherClassAssignment",
  teacherClassAssignmentSchema,
  "teacherClassAssignments",
);
if (!Student.schema.path("photo")) {
  Student.schema.add({ photo: { type: String, default: "" } });
}
if (!Teacher.schema.path("photo")) {
  Teacher.schema.add({ photo: { type: String, default: "" } });
}
export const Staff = model("Staff", staffSchema, "staff");
export const SchoolClass = model("SchoolClass", classSchema, "classes");
export const Section = model("Section", sectionSchema, "sections");
export const Subject = model("Subject", subjectSchema, "subjects");
export const AcademicSession = model("AcademicSession", academicSessionSchema, "academicSessions");
export const StudentEnrollment = model("StudentEnrollment", studentEnrollmentSchema, "studentEnrollments");
export const EnrollmentAudit = model("EnrollmentAudit", enrollmentAuditSchema, "enrollmentAudits");
export const Attendance = model("Attendance", attendanceSchema, "attendance");
export const AttendanceSession = model("AttendanceSession", attendanceSessionSchema, "attendanceSessions");
export const AttendanceAudit = model("AttendanceAudit", attendanceAuditSchema, "attendanceAudits");
export const TeacherAttendance = model("TeacherAttendance", teacherAttendanceSchema, "teacherAttendance");
export const Timetable = model("Timetable", timetableSchema, "timetables");
export const Homework = model("Homework", homeworkSchema, "homework");
if (mongoose.models.Exam && !mongoose.models.Exam.schema.path("classId")) {
  delete mongoose.models.Exam;
}
export const Exam = model("Exam", examSchema, "exams");
export const ExamSchedule = model("ExamSchedule", examScheduleSchema, "examSchedules");
export const Mark = model("Mark", markSchema, "marks");
if (mongoose.models.Result && !mongoose.models.Result.schema.path("gainedMarks")) {
  delete mongoose.models.Result;
}
export const Result = model("Result", resultSchema, "results");
export const FeeStructure = model("FeeStructure", feeStructureSchema, "feeStructures");
if (mongoose.models.StudentFee && !mongoose.models.StudentFee.schema.path("description")) {
  delete mongoose.models.StudentFee;
}
export const StudentFee = model("StudentFee", studentFeeSchema, "studentFees");
export const FeePayment = model("FeePayment", feePaymentSchema, "feePayments");
export const Expense = model("Expense", expenseSchema, "expenses");
export const SalaryStructure = model("SalaryStructure", salaryStructureSchema, "salaryStructures");
if (mongoose.models.Payroll && !mongoose.models.Payroll.schema.path("teacherId")) {
  delete mongoose.models.Payroll;
}
export const Payroll = model("Payroll", payrollSchema, "payroll");
if (mongoose.models.LeaveType && !mongoose.models.LeaveType.schema.path("code")) {
  delete mongoose.models.LeaveType;
}
export const LeaveType = model("LeaveType", leaveTypeSchema, "leaveTypes");
if (mongoose.models.LeaveRequest && !mongoose.models.LeaveRequest.schema.path("teacherId")) {
  delete mongoose.models.LeaveRequest;
}
export const LeaveRequest = model("LeaveRequest", leaveRequestSchema, "leaveRequests");
export const PublicHoliday = model("PublicHoliday", publicHolidaySchema, "publicHolidays");
export const Book = model("Book", bookSchema, "books");
export const BookIssue = model("BookIssue", bookIssueSchema, "bookIssues");
export const Vehicle = model("Vehicle", vehicleSchema, "vehicles");
export const TransportRoute = model("TransportRoute", routeSchema, "routes");
export const TransportAssignment = model("TransportAssignment", transportAssignmentSchema, "transportAssignments");
export const InventoryItem = model("InventoryItem", inventoryItemSchema, "inventoryItems");
export const InventoryTransaction = model("InventoryTransaction", inventoryTransactionSchema, "inventoryTransactions");
export const Notice = model("Notice", noticeSchema, "notices");
export const Notification = model("Notification", notificationSchema, "notifications");
export const Document = model("Document", documentSchema, "documents");
export const AuditLog = model("AuditLog", auditLogSchema, "auditLogs");
export const Settings = model("Settings", settingsSchema, "settings");
