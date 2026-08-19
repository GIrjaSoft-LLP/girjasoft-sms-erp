import mongoose from "mongoose";
import { ApiError } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { generateAdmissionNumber } from "@/lib/admissions/numbers";
import { getAdmissionSettings } from "@/lib/admissions/settings";
import { ensureParentLogin, syncParentStudents } from "@/lib/parent-account";
import type { SessionPayload } from "@/lib/session";
import { AdmissionApplication } from "@/models/admissions";
import { FeePayment, FeeStructure, Parent, Student, StudentFee } from "@/models/workspace";

function studentFullName(student: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
}) {
  const composed = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ").trim();
  return composed || student.name || "Student";
}

function formatAddress(address: {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}) {
  return [address.address, address.city, address.state, address.pinCode, address.country].filter(Boolean).join(", ");
}

export async function convertApplicationToStudent(
  session: SessionPayload,
  workspaceId: string,
  applicationId: string,
) {
  const settings = await getAdmissionSettings(workspaceId);
  const application = await AdmissionApplication.findOne({ _id: applicationId, workspaceId });
  if (!application) throw new ApiError(404, "Application not found.");
  if (application.convertedStudentId) {
    throw new ApiError(409, "Application already converted to student.");
  }
  if (application.status !== "CONFIRMED" && application.status !== "APPROVED") {
    throw new ApiError(400, "Application must be approved or confirmed before conversion.");
  }
  if (settings.requireDocumentVerification) {
    const pendingMandatory = (application.documents ?? []).some(
      (doc: { mandatory?: boolean; status?: string }) => doc.mandatory && doc.status !== "VERIFIED",
    );
    if (pendingMandatory) throw new ApiError(400, "Mandatory documents must be verified first.");
  }
  if (settings.requirePaymentBeforeConfirm && Number(application.fees?.due ?? 0) > 0) {
    throw new ApiError(400, "Outstanding admission fees must be collected before conversion.");
  }

  const admissionNumber =
    application.admissionNumber || (await generateAdmissionNumber(workspaceId, application.academicSessionId));
  const studentName = studentFullName(application.student ?? {});
  const address = application.sameAsPermanent
    ? formatAddress(application.permanentAddress ?? {})
    : formatAddress(application.currentAddress ?? {});

  const existingStudent = await Student.findOne({
    workspaceId,
    admissionNumber,
  });
  if (existingStudent) throw new ApiError(409, "Admission number already exists.");

  const parentName = application.father?.name || application.mother?.name || "Parent";
  const parentPhone = application.father?.mobile || application.mother?.mobile || "";
  const parentEmail = application.father?.email || application.mother?.email || "";

  let parent = parentPhone
    ? await Parent.findOne({ workspaceId, phone: parentPhone })
    : parentEmail
      ? await Parent.findOne({ workspaceId, email: parentEmail })
      : null;

  if (!parent) {
    parent = await Parent.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: parentName,
      email: parentEmail,
      phone: parentPhone,
      relation: application.father?.name ? "Father" : "Mother",
      address,
      status: "ACTIVE",
      studentIds: [],
    });
  }

  const student = await Student.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    admissionNumber,
    name: studentName,
    gender: application.student?.gender ?? "",
    dateOfBirth: application.student?.dateOfBirth ?? "",
    classId: application.applyingClassId,
    sectionId: application.applyingSectionId,
    parentId: parent._id,
    phone: parentPhone,
    email: parentEmail,
    address,
    status: "ACTIVE",
    academicSessionId: application.academicSessionId,
  });

  await syncParentStudents(workspaceId, parent._id as mongoose.Types.ObjectId, [
    ...(parent.studentIds ?? []).map(String),
    String(student._id),
  ]);

  const refreshedParent = await Parent.findById(parent._id);
  if (!refreshedParent) throw new ApiError(500, "Parent record could not be refreshed.");

  let parentCredentials: { username: string; temporaryPassword?: string } | undefined;
  if (settings.autoCreateParentAccount) {
    const login = await ensureParentLogin({
      workspaceId,
      parent: refreshedParent,
      createPassword: true,
    });
    parentCredentials = {
      username: login.user.username,
      temporaryPassword: login.temporaryPassword,
    };
  }

  const feeStructures = await FeeStructure.find({
    workspaceId,
    classId: application.applyingClassId,
  }).lean();
  for (const structure of feeStructures) {
    const exists = await StudentFee.findOne({
      workspaceId,
      studentId: student._id,
      feeStructureId: structure._id,
    });
    if (exists) continue;
    await StudentFee.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      studentId: student._id,
      feeStructureId: structure._id,
      amount: structure.amount,
      dueDate: new Date().toISOString().slice(0, 10),
      status: "PENDING",
      paidAmount: 0,
    });
  }

  for (const payment of application.paymentRecords ?? []) {
    if (!payment.amount) continue;
    const receiptNumber =
      payment.receiptNumber ||
      `ADM-${admissionNumber.replace(/\W+/g, "")}-${Date.now().toString().slice(-6)}`;
    const exists = await FeePayment.findOne({ workspaceId, receiptNumber });
    if (exists) continue;
    await FeePayment.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      studentId: student._id,
      amount: payment.amount,
      method: payment.method,
      receiptNumber,
      date: payment.date || new Date().toISOString().slice(0, 10),
      remarks: payment.remarks || "Admission payment",
    });
  }

  application.convertedStudentId = student._id as mongoose.Types.ObjectId;
  application.convertedParentId = parent._id as mongoose.Types.ObjectId;
  application.admissionNumber = admissionNumber;
  application.status = "CONFIRMED";
  application.workflowHistory.push({
    action: "CONVERTED_TO_STUDENT",
    status: "CONFIRMED",
    userId: session.sub,
    userEmail: session.email,
    remarks: `Student ${admissionNumber} created`,
    at: new Date(),
  });
  await application.save();

  if (application.academicSessionId && application.applyingClassId && application.applyingSectionId) {
    const { createInitialEnrollment } = await import("@/lib/enrollment/service");
    await createInitialEnrollment({
      workspaceId,
      studentId: String(student._id),
      academicSessionId: String(application.academicSessionId),
      classId: String(application.applyingClassId),
      sectionId: String(application.applyingSectionId),
      changedBy: session.sub,
      changedByEmail: session.email,
    });
  }

  await logWorkspace(session, workspaceId, "ADMISSION_CONVERTED", "admissions", String(application._id), {
    studentId: String(student._id),
    parentId: String(parent._id),
    admissionNumber,
  });

  return {
    student,
    parent,
    parentCredentials,
    admissionNumber,
    application,
  };
}
