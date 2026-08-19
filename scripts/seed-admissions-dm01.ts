import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_ADMISSION_SETTINGS } from "../src/config/admissions";
import { computeFeeTotals } from "../src/lib/admissions/numbers";
import { buildDocumentChecklist } from "../src/lib/admissions/settings";
import { AdmissionApplication, AdmissionEnquiry, AdmissionFollowUp } from "../src/models/admissions";
import { Workspace } from "../src/models/platform";
import { AcademicSession, SchoolClass, Settings } from "../src/models/workspace";

const WORKSPACE_CODE = "GIRJSOFT-DM-01";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(uri);

  const workspace = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (!workspace) throw new Error(`Workspace ${WORKSPACE_CODE} not found.`);
  const workspaceId = String(workspace._id);

  const [session, schoolClass] = await Promise.all([
    AcademicSession.findOne({ workspaceId }).sort({ createdAt: -1 }),
    SchoolClass.findOne({ workspaceId }).sort({ numericName: 1 }),
  ]);

  await Settings.findOneAndUpdate(
    { workspaceId },
    { $set: { admission: DEFAULT_ADMISSION_SETTINGS } },
    { upsert: true },
  );

  const existing = await AdmissionEnquiry.countDocuments({ workspaceId });
  if (existing > 0) {
    console.log(`Admission demo data already exists (${existing} enquiries). Skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  const fees = computeFeeTotals(DEFAULT_ADMISSION_SETTINGS.feeHeads);
  const documents = buildDocumentChecklist(DEFAULT_ADMISSION_SETTINGS);

  const enquiries = await AdmissionEnquiry.insertMany([
    {
      workspaceId,
      enquiryNumber: "ENQ/2026-27/0001",
      studentName: "Aarav Sharma",
      dateOfBirth: "2021-04-12",
      gender: "Male",
      applyingClassId: schoolClass?._id ?? null,
      academicSessionId: session?._id ?? null,
      parentName: "Rahul Sharma",
      parentMobile: "9876500101",
      parentEmail: "rahul.sharma@example.com",
      enquiryDate: "2026-08-01",
      source: "Walk-in",
      status: "NEW",
      followUpDate: "2026-08-18",
    },
    {
      workspaceId,
      enquiryNumber: "ENQ/2026-27/0002",
      studentName: "Isha Patel",
      dateOfBirth: "2020-11-03",
      gender: "Female",
      applyingClassId: schoolClass?._id ?? null,
      academicSessionId: session?._id ?? null,
      parentName: "Neha Patel",
      parentMobile: "9876500102",
      parentEmail: "neha.patel@example.com",
      enquiryDate: "2026-08-05",
      source: "Website",
      status: "FOLLOW_UP_REQUIRED",
      followUpDate: "2026-08-17",
    },
    {
      workspaceId,
      enquiryNumber: "ENQ/2026-27/0003",
      studentName: "Vihaan Mehta",
      dateOfBirth: "2022-01-20",
      gender: "Male",
      applyingClassId: schoolClass?._id ?? null,
      academicSessionId: session?._id ?? null,
      parentName: "Karan Mehta",
      parentMobile: "9876500103",
      enquiryDate: "2026-08-10",
      source: "Referral",
      status: "CONTACTED",
    },
  ]);

  const draftApp = await AdmissionApplication.create({
    workspaceId,
    applicationNumber: "APP/2026-27/0001",
    type: "APPLICATION",
    status: "DRAFT",
    academicSessionId: session?._id ?? null,
    applyingClassId: schoolClass?._id ?? null,
    enquiryId: enquiries[0]._id,
    student: { name: "Aarav Sharma", dateOfBirth: "2021-04-12", gender: "Male" },
    father: { name: "Rahul Sharma", mobile: "9876500101", email: "rahul.sharma@example.com" },
    applicationDate: "2026-08-12",
    documents,
    fees: { ...DEFAULT_ADMISSION_SETTINGS.feeHeads, ...fees },
    workflowHistory: [{ action: "CREATED_FROM_ENQUIRY", status: "DRAFT", at: new Date() }],
  });

  const submittedDocs = documents.map((doc, i) => ({
    ...doc,
    status: i < 2 ? "UPLOADED" : doc.status,
    url: i < 2 ? `/uploads/demo/${doc.key}.pdf` : "",
  }));

  await AdmissionApplication.insertMany([
    {
      workspaceId,
      applicationNumber: "APP/2026-27/0002",
      type: "APPLICATION",
      status: "UNDER_REVIEW",
      academicSessionId: session?._id ?? null,
      applyingClassId: schoolClass?._id ?? null,
      student: { name: "Isha Patel", dateOfBirth: "2020-11-03", gender: "Female", aadhaar: "123456789012" },
      father: { name: "Neha Patel", mobile: "9876500102", email: "neha.patel@example.com" },
      applicationDate: "2026-08-08",
      documents: submittedDocs,
      fees: { ...DEFAULT_ADMISSION_SETTINGS.feeHeads, ...fees, paid: 1500, due: fees.net - 1500 },
      paymentRecords: [{ amount: 1500, method: "UPI", receiptNumber: "ADM-RCP-001", date: "2026-08-08" }],
      workflowHistory: [
        { action: "SUBMITTED", status: "SUBMITTED", at: new Date("2026-08-08") },
        { action: "UNDER_REVIEW", status: "UNDER_REVIEW", at: new Date("2026-08-09") },
      ],
    },
    {
      workspaceId,
      applicationNumber: "APP/2026-27/0003",
      type: "DIRECT",
      status: "PAYMENT_PENDING",
      academicSessionId: session?._id ?? null,
      applyingClassId: schoolClass?._id ?? null,
      student: { name: "Ananya Reddy", dateOfBirth: "2021-07-19", gender: "Female" },
      father: { name: "Suresh Reddy", mobile: "9876500104" },
      applicationDate: "2026-08-11",
      documents: submittedDocs.map((d) => ({ ...d, status: "VERIFIED", verifiedBy: "admin@demo.local", verifiedAt: new Date() })),
      fees: { ...DEFAULT_ADMISSION_SETTINGS.feeHeads, ...fees, paid: fees.net - 2000, due: 2000 },
      admissionNumber: "ADM/2026-27/0001",
      workflowHistory: [
        { action: "DIRECT_ADMISSION_CREATED", status: "DRAFT", at: new Date("2026-08-11") },
        { action: "APPROVED", status: "APPROVED", at: new Date("2026-08-12") },
        { action: "PAYMENT_REQUIRED", status: "PAYMENT_PENDING", at: new Date("2026-08-12") },
      ],
    },
    {
      workspaceId,
      applicationNumber: "APP/2026-27/0004",
      type: "APPLICATION",
      status: "CANCELLED",
      academicSessionId: session?._id ?? null,
      applyingClassId: schoolClass?._id ?? null,
      student: { name: "Kabir Singh", dateOfBirth: "2020-03-02", gender: "Male" },
      father: { name: "Manoj Singh", mobile: "9876500105" },
      applicationDate: "2026-07-20",
      documents,
      fees: { ...DEFAULT_ADMISSION_SETTINGS.feeHeads, ...fees, paid: 1000, due: fees.net - 1000 },
      cancellation: {
        date: "2026-08-01",
        reason: "Relocated to another city",
        refundAmount: 1000,
        deduction: 200,
        netRefund: 800,
        refundStatus: "PROCESSED",
        approvedBy: "admin@demo.local",
        approvalDate: "2026-08-02",
      },
      workflowHistory: [{ action: "CANCELLED", status: "CANCELLED", at: new Date("2026-08-01") }],
    },
  ]);

  await enquiries[0].updateOne({ applicationId: draftApp._id, status: "APPLICATION_STARTED" });

  await AdmissionFollowUp.insertMany([
    {
      workspaceId,
      enquiryId: enquiries[1]._id,
      followUpDate: "2026-08-17",
      followUpTime: "11:00",
      applicantName: "Isha Patel",
      parentName: "Neha Patel",
      parentMobile: "9876500102",
      followUpType: "CALL",
      status: "PENDING",
      notes: "Discuss fee structure and document checklist.",
    },
    {
      workspaceId,
      enquiryId: enquiries[2]._id,
      followUpDate: "2026-08-14",
      followUpTime: "15:30",
      applicantName: "Vihaan Mehta",
      parentName: "Karan Mehta",
      parentMobile: "9876500103",
      followUpType: "VISIT",
      status: "COMPLETED",
      notes: "Campus visit completed.",
    },
  ]);

  console.log(`Seeded admission demo data for ${WORKSPACE_CODE}.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
