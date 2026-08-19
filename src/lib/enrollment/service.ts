import mongoose from "mongoose";
import type { PromotionStatus } from "@/config/promotion";
import { ApiError } from "@/lib/api/errors";
import { assertSectionHasSeat } from "@/lib/sections";
import {
  AcademicSession,
  EnrollmentAudit,
  SchoolClass,
  Section,
  Student,
  StudentEnrollment,
} from "@/models/workspace";

export async function getCurrentAcademicSession(workspaceId: string) {
  return AcademicSession.findOne({ workspaceId, isCurrent: true }).lean();
}

export async function getNextAcademicSession(workspaceId: string, currentSessionId?: string) {
  const current = currentSessionId
    ? await AcademicSession.findOne({ _id: currentSessionId, workspaceId }).lean()
    : await getCurrentAcademicSession(workspaceId);
  if (!current) return null;
  const sessions = await AcademicSession.find({ workspaceId }).sort({ startDate: 1, name: 1 }).lean();
  const index = sessions.findIndex((row) => String(row._id) === String(current._id));
  return index >= 0 && index < sessions.length - 1 ? sessions[index + 1] : null;
}

export async function getStudentCurrentEnrollment(workspaceId: string, studentId: string) {
  const enrollment = await StudentEnrollment.findOne({
    workspaceId,
    studentId,
    isCurrent: true,
  }).lean();
  if (enrollment) return enrollment;
  const student = await Student.findOne({ _id: studentId, workspaceId }).lean();
  if (!student?.academicSessionId || !student.classId || !student.sectionId) return null;
  return {
    _id: student.currentEnrollmentId ?? null,
    studentId: student._id,
    academicSessionId: student.academicSessionId,
    classId: student.classId,
    sectionId: student.sectionId,
    rollNumber: "",
    promotionStatus: "ENROLLED" as PromotionStatus,
    isCurrent: true,
  };
}

export async function getStudentEnrollmentHistory(workspaceId: string, studentId: string) {
  const rows = await StudentEnrollment.find({ workspaceId, studentId })
    .sort({ createdAt: -1 })
    .lean();
  if (rows.length) return rows;

  const student = await Student.findOne({ _id: studentId, workspaceId }).lean();
  if (!student?.academicSessionId) return [];
  return [
    {
      _id: student.currentEnrollmentId ?? student._id,
      studentId: student._id,
      academicSessionId: student.academicSessionId,
      classId: student.classId,
      sectionId: student.sectionId,
      rollNumber: "",
      promotionStatus: "ENROLLED" as PromotionStatus,
      isCurrent: true,
      createdAt: student.createdAt,
    },
  ];
}

type AuditInput = {
  workspaceId: string;
  studentId: string;
  enrollmentId?: string | null;
  action: string;
  oldAcademicSessionId?: string | null;
  newAcademicSessionId?: string | null;
  oldClassId?: string | null;
  newClassId?: string | null;
  oldSectionId?: string | null;
  newSectionId?: string | null;
  oldRollNumber?: string;
  newRollNumber?: string;
  oldPromotionStatus?: string;
  newPromotionStatus?: string;
  reason?: string;
  changedBy: string;
  changedByEmail: string;
};

export async function writeEnrollmentAudit(input: AuditInput) {
  await EnrollmentAudit.create({
    workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
    studentId: new mongoose.Types.ObjectId(input.studentId),
    enrollmentId: input.enrollmentId ? new mongoose.Types.ObjectId(input.enrollmentId) : null,
    action: input.action,
    oldAcademicSessionId: input.oldAcademicSessionId
      ? new mongoose.Types.ObjectId(input.oldAcademicSessionId)
      : null,
    newAcademicSessionId: input.newAcademicSessionId
      ? new mongoose.Types.ObjectId(input.newAcademicSessionId)
      : null,
    oldClassId: input.oldClassId ? new mongoose.Types.ObjectId(input.oldClassId) : null,
    newClassId: input.newClassId ? new mongoose.Types.ObjectId(input.newClassId) : null,
    oldSectionId: input.oldSectionId ? new mongoose.Types.ObjectId(input.oldSectionId) : null,
    newSectionId: input.newSectionId ? new mongoose.Types.ObjectId(input.newSectionId) : null,
    oldRollNumber: input.oldRollNumber ?? "",
    newRollNumber: input.newRollNumber ?? "",
    oldPromotionStatus: input.oldPromotionStatus ?? "",
    newPromotionStatus: input.newPromotionStatus ?? "",
    reason: input.reason ?? "",
    changedBy: input.changedBy,
    changedByEmail: input.changedByEmail,
  });
}

export async function createInitialEnrollment(input: {
  workspaceId: string;
  studentId: string;
  academicSessionId: string;
  classId: string;
  sectionId: string;
  rollNumber?: string;
  changedBy?: string;
  changedByEmail?: string;
}) {
  const exists = await StudentEnrollment.findOne({
    workspaceId: input.workspaceId,
    studentId: input.studentId,
    academicSessionId: input.academicSessionId,
  });
  if (exists) return exists;

  await StudentEnrollment.updateMany(
    { workspaceId: input.workspaceId, studentId: input.studentId, isCurrent: true },
    { $set: { isCurrent: false } },
  );

  const enrollment = await StudentEnrollment.create({
    workspaceId: new mongoose.Types.ObjectId(input.workspaceId),
    studentId: new mongoose.Types.ObjectId(input.studentId),
    academicSessionId: new mongoose.Types.ObjectId(input.academicSessionId),
    classId: new mongoose.Types.ObjectId(input.classId),
    sectionId: new mongoose.Types.ObjectId(input.sectionId),
    rollNumber: input.rollNumber ?? "",
    promotionStatus: "ENROLLED",
    isCurrent: true,
    status: "ACTIVE",
  });

  await Student.findByIdAndUpdate(input.studentId, {
    $set: {
      classId: input.classId,
      sectionId: input.sectionId,
      academicSessionId: input.academicSessionId,
      currentEnrollmentId: enrollment._id,
    },
  });

  if (input.changedBy) {
    await writeEnrollmentAudit({
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      enrollmentId: String(enrollment._id),
      action: "INITIAL_ENROLLMENT",
      newAcademicSessionId: input.academicSessionId,
      newClassId: input.classId,
      newSectionId: input.sectionId,
      newRollNumber: input.rollNumber ?? "",
      newPromotionStatus: "ENROLLED",
      changedBy: input.changedBy,
      changedByEmail: input.changedByEmail ?? "",
    });
  }

  return enrollment;
}

export async function validateSectionBelongsToClass(classId: string, sectionId: string, workspaceId: string) {
  const section = await Section.findOne({ _id: sectionId, workspaceId, classId }).lean();
  if (!section) throw new ApiError(400, "Selected section does not belong to the selected class.");
  return section;
}

export async function validateSectionCapacityBatch(
  workspaceId: string,
  assignments: Array<{ sectionId: string; studentId: string }>,
  overrideCapacity = false,
) {
  const counts = new Map<string, number>();
  for (const row of assignments) {
    counts.set(row.sectionId, (counts.get(row.sectionId) ?? 0) + 1);
  }

  for (const [sectionId, incoming] of counts.entries()) {
    const section = await Section.findOne({ _id: sectionId, workspaceId }).lean();
    if (!section) throw new ApiError(400, "Invalid destination section.");
    const current = await Student.countDocuments({
      workspaceId,
      sectionId,
      status: "ACTIVE",
      _id: { $nin: assignments.filter((row) => row.sectionId === sectionId).map((row) => row.studentId) },
    });
    if (!overrideCapacity && current + incoming > section.capacity) {
      throw new ApiError(
        400,
        `Section "${section.name}" capacity reached. Available seats: ${Math.max(section.capacity - current, 0)}.`,
      );
    }
  }
}

export async function updateCurrentEnrollment(
  workspaceId: string,
  studentId: string,
  input: {
    classId?: string;
    sectionId?: string;
    rollNumber?: string;
    reason?: string;
    changedBy: string;
    changedByEmail: string;
    overrideCapacity?: boolean;
  },
) {
  const student = await Student.findOne({ _id: studentId, workspaceId });
  if (!student) throw new ApiError(404, "Student not found.");

  const enrollment = await StudentEnrollment.findOne({ workspaceId, studentId, isCurrent: true });
  const classId = input.classId ?? String(enrollment?.classId ?? student.classId ?? "");
  const sectionId = input.sectionId ?? String(enrollment?.sectionId ?? student.sectionId ?? "");

  if (!classId || !sectionId) throw new ApiError(400, "Class and section are required.");
  await validateSectionBelongsToClass(classId, sectionId, workspaceId);
  if (!input.overrideCapacity) {
    await assertSectionHasSeat(workspaceId, sectionId, studentId);
  }

  const oldClassId = String(enrollment?.classId ?? student.classId ?? "");
  const oldSectionId = String(enrollment?.sectionId ?? student.sectionId ?? "");
  const oldRollNumber = enrollment?.rollNumber ?? "";

  if (enrollment) {
    if (input.classId) enrollment.classId = new mongoose.Types.ObjectId(input.classId);
    if (input.sectionId) enrollment.sectionId = new mongoose.Types.ObjectId(input.sectionId);
    if (input.rollNumber !== undefined) enrollment.rollNumber = input.rollNumber;
    await enrollment.save();
  } else if (student.academicSessionId) {
    await createInitialEnrollment({
      workspaceId,
      studentId,
      academicSessionId: String(student.academicSessionId),
      classId,
      sectionId,
      rollNumber: input.rollNumber,
      changedBy: input.changedBy,
      changedByEmail: input.changedByEmail,
    });
  }

  student.classId = new mongoose.Types.ObjectId(classId);
  student.sectionId = new mongoose.Types.ObjectId(sectionId);
  await student.save();

  await writeEnrollmentAudit({
    workspaceId,
    studentId,
    enrollmentId: enrollment ? String(enrollment._id) : null,
    action: "ENROLLMENT_UPDATE",
    oldAcademicSessionId: student.academicSessionId ? String(student.academicSessionId) : null,
    newAcademicSessionId: student.academicSessionId ? String(student.academicSessionId) : null,
    oldClassId,
    newClassId: classId,
    oldSectionId,
    newSectionId: sectionId,
    oldRollNumber,
    newRollNumber: input.rollNumber ?? oldRollNumber,
    reason: input.reason ?? "",
    changedBy: input.changedBy,
    changedByEmail: input.changedByEmail,
  });

  return student;
}

export async function hydrateEnrollmentRows(
  workspaceId: string,
  rows: Array<{
    _id?: unknown;
    studentId?: unknown;
    academicSessionId?: unknown;
    classId?: unknown;
    sectionId?: unknown;
    rollNumber?: string;
    promotionStatus?: string;
    isCurrent?: boolean;
    createdAt?: Date;
  }>,
) {
  const collectIds = (values: unknown[]) =>
    [...new Set(
      values
        .filter((value) => value != null && value !== "" && mongoose.isValidObjectId(String(value)))
        .map((value) => String(value)),
    )];

  const sessionIds = collectIds(rows.map((row) => row.academicSessionId));
  const classIds = collectIds(rows.map((row) => row.classId));
  const sectionIds = collectIds(rows.map((row) => row.sectionId));
  const [sessions, classes, sections] = await Promise.all([
    sessionIds.length
      ? AcademicSession.find({ workspaceId, _id: { $in: sessionIds } }).select("name").lean()
      : [],
    classIds.length ? SchoolClass.find({ workspaceId, _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ workspaceId, _id: { $in: sectionIds } }).select("name").lean() : [],
  ]);
  const sessionMap = new Map(sessions.map((row) => [String(row._id), row.name]));
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));

  return rows.map((row) => ({
    _id: row._id ? String(row._id) : "",
    academicSessionId: String(row.academicSessionId ?? ""),
    academicSessionName: sessionMap.get(String(row.academicSessionId)) ?? "",
    classId: String(row.classId ?? ""),
    className: classMap.get(String(row.classId)) ?? "",
    sectionId: String(row.sectionId ?? ""),
    sectionName: sectionMap.get(String(row.sectionId)) ?? "",
    rollNumber: row.rollNumber ?? "",
    promotionStatus: row.promotionStatus ?? "ENROLLED",
    isCurrent: Boolean(row.isCurrent),
    createdAt: row.createdAt ?? null,
  }));
}
