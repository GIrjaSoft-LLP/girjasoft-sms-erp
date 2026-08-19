import mongoose, { Schema } from "mongoose";

function tenantFields() {
  return {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  };
}

const addressSchema = {
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "India" },
  pinCode: { type: String, default: "" },
};

const parentContactSchema = {
  name: { type: String, default: "" },
  mobile: { type: String, default: "" },
  email: { type: String, default: "" },
  occupation: { type: String, default: "" },
  company: { type: String, default: "" },
  designation: { type: String, default: "" },
  annualIncome: { type: Number, default: 0 },
};

const documentSchema = {
  key: { type: String, required: true },
  name: { type: String, required: true },
  mandatory: { type: Boolean, default: false },
  url: { type: String, default: "" },
  mime: { type: String, default: "" },
  size: { type: Number, default: 0 },
  status: { type: String, default: "PENDING" },
  verifiedBy: { type: String, default: "" },
  verifiedAt: { type: Date, default: null },
  remarks: { type: String, default: "" },
};

const workflowEventSchema = {
  action: { type: String, required: true },
  status: { type: String, default: "" },
  userId: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  remarks: { type: String, default: "" },
  at: { type: Date, default: Date.now },
  previousValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
};

const paymentRecordSchema = {
  amount: { type: Number, required: true },
  method: { type: String, default: "CASH" },
  receiptNumber: { type: String, default: "" },
  date: { type: String, default: "" },
  remarks: { type: String, default: "" },
  feeType: { type: String, default: "ADMISSION" },
};

const discountSchema = {
  name: { type: String, required: true },
  discountType: { type: String, default: "PERCENTAGE" },
  percentage: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  eligibility: { type: String, default: "" },
  status: { type: String, default: "PENDING" },
  approvedBy: { type: String, default: "" },
  approvedAt: { type: Date, default: null },
};

const enquirySchema = new Schema(
  {
    ...tenantFields(),
    enquiryNumber: { type: String, required: true, trim: true },
    studentName: { type: String, required: true, trim: true },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, default: "" },
    applyingClassId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    parentName: { type: String, default: "" },
    parentMobile: { type: String, default: "" },
    parentEmail: { type: String, default: "" },
    enquiryDate: { type: String, required: true },
    source: { type: String, default: "" },
    preferredAdmissionDate: { type: String, default: "" },
    remarks: { type: String, default: "" },
    assignedStaffId: { type: String, default: "" },
    assignedStaffName: { type: String, default: "" },
    followUpDate: { type: String, default: "" },
    followUpRemarks: { type: String, default: "" },
    status: { type: String, default: "NEW", index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "AdmissionApplication", default: null },
  },
  { timestamps: true },
);
enquirySchema.index({ workspaceId: 1, enquiryNumber: 1 }, { unique: true });
enquirySchema.index({ workspaceId: 1, parentMobile: 1 });
enquirySchema.index({ workspaceId: 1, status: 1, enquiryDate: 1 });

const applicationSchema = new Schema(
  {
    ...tenantFields(),
    applicationNumber: { type: String, required: true, trim: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "AdmissionEnquiry", default: null },
    type: { type: String, enum: ["APPLICATION", "DIRECT"], default: "APPLICATION" },
    status: { type: String, default: "DRAFT", index: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", default: null },
    applyingClassId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    applyingSectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    student: {
      firstName: { type: String, default: "" },
      middleName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      name: { type: String, default: "" },
      dateOfBirth: { type: String, default: "" },
      gender: { type: String, default: "" },
      bloodGroup: { type: String, default: "" },
      aadhaar: { type: String, default: "" },
      nationality: { type: String, default: "Indian" },
      religion: { type: String, default: "" },
      category: { type: String, default: "" },
      motherTongue: { type: String, default: "" },
      previousSchool: { type: String, default: "" },
      previousClass: { type: String, default: "" },
      previousPerformance: { type: String, default: "" },
    },
    father: parentContactSchema,
    mother: parentContactSchema,
    permanentAddress: addressSchema,
    currentAddress: addressSchema,
    sameAsPermanent: { type: Boolean, default: false },
    previousSchoolInfo: {
      schoolName: { type: String, default: "" },
      board: { type: String, default: "" },
      address: { type: String, default: "" },
      previousClass: { type: String, default: "" },
      lastAcademicSession: { type: String, default: "" },
      tcNumber: { type: String, default: "" },
      tcDate: { type: String, default: "" },
      previousRollNumber: { type: String, default: "" },
      previousResult: { type: String, default: "" },
      reasonForLeaving: { type: String, default: "" },
    },
    documents: [documentSchema],
    fees: {
      registrationFee: { type: Number, default: 0 },
      applicationFee: { type: Number, default: 0 },
      admissionFee: { type: Number, default: 0 },
      securityDeposit: { type: Number, default: 0 },
      tuitionFee: { type: Number, default: 0 },
      transportFee: { type: Number, default: 0 },
      otherCharges: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      due: { type: Number, default: 0 },
    },
    discounts: [discountSchema],
    paymentRecords: [paymentRecordSchema],
    assignedStaffId: { type: String, default: "" },
    assignedStaffName: { type: String, default: "" },
    source: { type: String, default: "" },
    remarks: { type: String, default: "" },
    applicationDate: { type: String, default: "" },
    preferredAdmissionDate: { type: String, default: "" },
    convertedStudentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    convertedParentId: { type: Schema.Types.ObjectId, ref: "Parent", default: null },
    admissionNumber: { type: String, default: "" },
    duplicateWarningAcknowledged: { type: Boolean, default: false },
    linkedDuplicateIds: [{ type: Schema.Types.ObjectId }],
    cancellation: {
      date: { type: String, default: "" },
      reason: { type: String, default: "" },
      refundAmount: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      netRefund: { type: Number, default: 0 },
      refundStatus: { type: String, default: "NOT_APPLICABLE" },
      approvedBy: { type: String, default: "" },
      approvalDate: { type: String, default: "" },
      remarks: { type: String, default: "" },
    },
    workflowHistory: [workflowEventSchema],
  },
  { timestamps: true },
);
applicationSchema.index({ workspaceId: 1, applicationNumber: 1 }, { unique: true });
applicationSchema.index({ workspaceId: 1, status: 1 });
applicationSchema.index({ workspaceId: 1, "student.aadhaar": 1 });
applicationSchema.index({ workspaceId: 1, "father.mobile": 1 });
applicationSchema.index({ workspaceId: 1, "mother.mobile": 1 });

const followUpSchema = new Schema(
  {
    ...tenantFields(),
    enquiryId: { type: Schema.Types.ObjectId, ref: "AdmissionEnquiry", default: null },
    applicationId: { type: Schema.Types.ObjectId, ref: "AdmissionApplication", default: null },
    followUpDate: { type: String, required: true },
    followUpTime: { type: String, default: "" },
    applicantName: { type: String, default: "" },
    parentName: { type: String, default: "" },
    parentMobile: { type: String, default: "" },
    assignedStaffId: { type: String, default: "" },
    assignedStaffName: { type: String, default: "" },
    followUpType: { type: String, default: "CALL" },
    notes: { type: String, default: "" },
    nextFollowUpDate: { type: String, default: "" },
    status: { type: String, default: "PENDING", index: true },
  },
  { timestamps: true },
);
followUpSchema.index({ workspaceId: 1, followUpDate: 1, status: 1 });

function model(name: string, schema: Schema, collection: string) {
  return mongoose.models[name] || mongoose.model(name, schema, collection);
}

export const AdmissionEnquiry = model("AdmissionEnquiry", enquirySchema, "admissionEnquiries");
export const AdmissionApplication = model("AdmissionApplication", applicationSchema, "admissionApplications");
export const AdmissionFollowUp = model("AdmissionFollowUp", followUpSchema, "admissionFollowUps");
