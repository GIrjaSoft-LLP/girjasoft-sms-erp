import mongoose from "mongoose";
import type { PromotionStatus } from "@/config/promotion";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import {
  createInitialEnrollment,
  getCurrentAcademicSession,
  getNextAcademicSession,
  getStudentCurrentEnrollment,
  getStudentEnrollmentHistory,
  hydrateEnrollmentRows,
  validateSectionBelongsToClass,
  validateSectionCapacityBatch,
  writeEnrollmentAudit,
} from "@/lib/enrollment/service";
import {
  AcademicSession,
  FeeStructure,
  Parent,
  SchoolClass,
  Section,
  Student,
  StudentEnrollment,
  StudentFee,
} from "@/models/workspace";

type PromotionItem = {
  studentId: string;
  classId: string;
  sectionId: string;
  rollNumber?: string;
  promotionStatus?: PromotionStatus;
};

export async function getPromotionDashboard(ctx: TenantContext) {
  const workspaceId = ctx.workspaceId;
  const currentSession = await getCurrentAcademicSession(workspaceId);
  const nextSession = currentSession ? await getNextAcademicSession(workspaceId, String(currentSession._id)) : null;

  const activeStudents = await Student.find({ workspaceId, status: "ACTIVE" }).lean();
  const totalStudents = activeStudents.length;

  let promoted = 0;
  let pending = 0;
  let notPromoted = 0;
  let graduated = 0;
  let archived = 0;

  if (currentSession && nextSession) {
    const nextEnrollments = await StudentEnrollment.find({
      workspaceId,
      academicSessionId: nextSession._id,
    }).lean();
    const nextByStudent = new Map(nextEnrollments.map((row) => [String(row.studentId), row]));

    for (const student of activeStudents) {
      const next = nextByStudent.get(String(student._id));
      if (!next) {
        pending += 1;
        continue;
      }
      if (next.promotionStatus === "NOT_PROMOTED") notPromoted += 1;
      else if (next.promotionStatus === "GRADUATED") graduated += 1;
      else promoted += 1;
    }
  } else {
    pending = totalStudents;
  }

  archived = await Student.countDocuments({
    workspaceId,
    status: { $in: ["ARCHIVED", "TRANSFERRED", "GRADUATED"] },
  });

  return {
    currentSession: currentSession
      ? { _id: String(currentSession._id), name: currentSession.name }
      : null,
    nextSession: nextSession ? { _id: String(nextSession._id), name: nextSession.name } : null,
    stats: {
      totalStudents,
      promoted,
      pending,
      notPromoted,
      graduated,
      archived,
    },
  };
}

export async function listPromotionCandidates(
  ctx: TenantContext,
  filters: {
    academicSessionId?: string;
    classId?: string;
    sectionId?: string;
    targetSessionId?: string;
  },
) {
  const workspaceId = ctx.workspaceId;
  const sessionId =
    filters.academicSessionId ??
    (await getCurrentAcademicSession(workspaceId))?._id?.toString() ??
    "";
  if (!sessionId) throw new ApiError(400, "No current academic session configured.");

  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status: "ACTIVE",
  };
  if (filters.classId) query.classId = new mongoose.Types.ObjectId(filters.classId);
  if (filters.sectionId) query.sectionId = new mongoose.Types.ObjectId(filters.sectionId);

  const students = await Student.find(query).sort({ name: 1 }).lean();
  const enrollments = await StudentEnrollment.find({
    workspaceId,
    academicSessionId: sessionId,
    studentId: { $in: students.map((row) => row._id) },
  }).lean();
  const enrollmentMap = new Map(enrollments.map((row) => [String(row.studentId), row]));

  let targetEnrollments: typeof enrollments = [];
  if (filters.targetSessionId) {
    targetEnrollments = await StudentEnrollment.find({
      workspaceId,
      academicSessionId: filters.targetSessionId,
      studentId: { $in: students.map((row) => row._id) },
    }).lean();
  }
  const targetMap = new Map(targetEnrollments.map((row) => [String(row.studentId), row]));

  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));

  return students.map((student) => {
    const enrollment = enrollmentMap.get(String(student._id));
    const target = targetMap.get(String(student._id));
    return {
      _id: String(student._id),
      name: student.name,
      admissionNumber: student.admissionNumber,
      classId: String(student.classId ?? enrollment?.classId ?? ""),
      sectionId: String(student.sectionId ?? enrollment?.sectionId ?? ""),
      className: classMap.get(String(student.classId ?? enrollment?.classId)) ?? "",
      sectionName: sectionMap.get(String(student.sectionId ?? enrollment?.sectionId)) ?? "",
      rollNumber: enrollment?.rollNumber ?? "",
      promotionStatus: enrollment?.promotionStatus ?? "ENROLLED",
      alreadyPromoted: Boolean(target),
      targetEnrollment: target
        ? {
            classId: String(target.classId),
            sectionId: String(target.sectionId),
            rollNumber: target.rollNumber ?? "",
            promotionStatus: target.promotionStatus,
          }
        : null,
    };
  });
}

export async function previewPromotion(
  ctx: TenantContext,
  input: {
    fromSessionId: string;
    toSessionId: string;
    items: PromotionItem[];
    overrideCapacity?: boolean;
  },
) {
  const workspaceId = ctx.workspaceId;
  await validatePromotionInput(workspaceId, input);

  const sectionSummary = new Map<string, { sectionName: string; count: number; capacity: number }>();
  for (const item of input.items) {
    const section = await validateSectionBelongsToClass(item.classId, item.sectionId, workspaceId);
    const bucket = sectionSummary.get(String(section._id)) ?? {
      sectionName: section.name,
      count: 0,
      capacity: section.capacity,
    };
    bucket.count += 1;
    sectionSummary.set(String(section._id), bucket);
  }

  const warnings: string[] = [];
  for (const [sectionId, summary] of sectionSummary.entries()) {
    const current = await Student.countDocuments({ workspaceId, sectionId, status: "ACTIVE" });
    if (!input.overrideCapacity && current + summary.count > summary.capacity) {
      warnings.push(
        `Section ${summary.sectionName}: ${summary.count} incoming, only ${Math.max(summary.capacity - current, 0)} seats available.`,
      );
    }
  }

  const studentIds = input.items.map((row) => row.studentId);
  const students = await Student.find({ workspaceId, _id: { $in: studentIds } }).lean();
  const studentMap = new Map(students.map((row) => [String(row._id), row]));

  const rows = input.items.map((item) => {
    const student = studentMap.get(item.studentId);
    return {
      studentId: item.studentId,
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? "",
      classId: item.classId,
      sectionId: item.sectionId,
      rollNumber: item.rollNumber ?? "",
      promotionStatus: item.promotionStatus ?? "PROMOTED",
    };
  });

  return {
    fromSessionId: input.fromSessionId,
    toSessionId: input.toSessionId,
    studentCount: rows.length,
    rows,
    warnings,
    canProceed: warnings.length === 0 || Boolean(input.overrideCapacity),
  };
}

async function validatePromotionInput(
  workspaceId: string,
  input: { fromSessionId: string; toSessionId: string; items: PromotionItem[] },
) {
  if (!input.fromSessionId || !input.toSessionId) {
    throw new ApiError(400, "Source and destination academic sessions are required.");
  }
  if (input.fromSessionId === input.toSessionId) {
    throw new ApiError(400, "Destination academic session must be different from the source session.");
  }
  if (!input.items.length) throw new ApiError(400, "Select at least one student to promote.");

  const [fromSession, toSession] = await Promise.all([
    AcademicSession.findOne({ _id: input.fromSessionId, workspaceId }),
    AcademicSession.findOne({ _id: input.toSessionId, workspaceId }),
  ]);
  if (!fromSession || !toSession) throw new ApiError(400, "Invalid academic session.");

  for (const item of input.items) {
    const student = await Student.findOne({ _id: item.studentId, workspaceId });
    if (!student) throw new ApiError(400, `Student not found: ${item.studentId}`);
    await validateSectionBelongsToClass(item.classId, item.sectionId, workspaceId);

    const duplicate = await StudentEnrollment.findOne({
      workspaceId,
      studentId: item.studentId,
      academicSessionId: input.toSessionId,
    });
    if (duplicate) {
      throw new ApiError(
        409,
        `${student.name} already has an enrollment for academic session ${toSession.name}.`,
      );
    }
  }
}

async function assignFeesForClass(workspaceId: string, studentId: string, classId: string) {
  const structures = await FeeStructure.find({ workspaceId, classId }).lean();
  for (const structure of structures) {
    const exists = await StudentFee.findOne({
      workspaceId,
      studentId,
      feeStructureId: structure._id,
    });
    if (exists) continue;
    await StudentFee.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      studentId: new mongoose.Types.ObjectId(studentId),
      feeStructureId: structure._id,
      amount: structure.amount,
      dueDate: new Date().toISOString().slice(0, 10),
      status: "PENDING",
      paidAmount: 0,
    });
  }
}

export async function executePromotion(
  ctx: TenantContext,
  input: {
    fromSessionId: string;
    toSessionId: string;
    items: PromotionItem[];
    reason?: string;
    overrideCapacity?: boolean;
  },
) {
  const workspaceId = ctx.workspaceId;
  await validatePromotionInput(workspaceId, input);
  await validateSectionCapacityBatch(
    workspaceId,
    input.items.map((row) => ({ sectionId: row.sectionId, studentId: row.studentId })),
    input.overrideCapacity,
  );

  let promotedCount = 0;

  for (const item of input.items) {
    const student = await Student.findOne({ _id: item.studentId, workspaceId });
    if (!student) continue;

    const currentEnrollment = await StudentEnrollment.findOne({
      workspaceId,
      studentId: item.studentId,
      isCurrent: true,
    });

    const outcome = item.promotionStatus ?? "PROMOTED";
    const oldClassId = String(currentEnrollment?.classId ?? student.classId ?? "");
    const oldSectionId = String(currentEnrollment?.sectionId ?? student.sectionId ?? "");
    const oldRollNumber = currentEnrollment?.rollNumber ?? "";

    if (currentEnrollment) {
      currentEnrollment.isCurrent = false;
      currentEnrollment.status = "COMPLETED";
      currentEnrollment.promotionStatus =
        outcome === "NOT_PROMOTED" ? "NOT_PROMOTED" : outcome === "GRADUATED" ? "GRADUATED" : "PROMOTED";
      await currentEnrollment.save();
    }

    if (outcome === "GRADUATED") {
      student.status = "GRADUATED";
      await student.save();
      await writeEnrollmentAudit({
        workspaceId,
        studentId: item.studentId,
        action: "GRADUATED",
        oldAcademicSessionId: input.fromSessionId,
        oldClassId,
        oldSectionId,
        oldRollNumber,
        newPromotionStatus: "GRADUATED",
        reason: input.reason ?? "",
        changedBy: ctx.session.sub,
        changedByEmail: ctx.session.email,
      });
      promotedCount += 1;
      continue;
    }

    if (outcome === "TRANSFERRED" || outcome === "ARCHIVED") {
      student.status = outcome;
      await student.save();
      await writeEnrollmentAudit({
        workspaceId,
        studentId: item.studentId,
        action: outcome,
        oldAcademicSessionId: input.fromSessionId,
        oldClassId,
        oldSectionId,
        oldRollNumber,
        newPromotionStatus: outcome,
        reason: input.reason ?? "",
        changedBy: ctx.session.sub,
        changedByEmail: ctx.session.email,
      });
      promotedCount += 1;
      continue;
    }

    await StudentEnrollment.updateMany(
      { workspaceId, studentId: item.studentId, isCurrent: true },
      { $set: { isCurrent: false } },
    );

    const newEnrollment = await StudentEnrollment.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      studentId: new mongoose.Types.ObjectId(item.studentId),
      academicSessionId: new mongoose.Types.ObjectId(input.toSessionId),
      classId: new mongoose.Types.ObjectId(item.classId),
      sectionId: new mongoose.Types.ObjectId(item.sectionId),
      rollNumber: item.rollNumber ?? "",
      promotionStatus: outcome === "NOT_PROMOTED" ? "ENROLLED" : "ENROLLED",
      isCurrent: true,
      status: "ACTIVE",
    });

    student.classId = new mongoose.Types.ObjectId(item.classId);
    student.sectionId = new mongoose.Types.ObjectId(item.sectionId);
    student.academicSessionId = new mongoose.Types.ObjectId(input.toSessionId);
    student.currentEnrollmentId = newEnrollment._id as mongoose.Types.ObjectId;
    student.status = "ACTIVE";
    await student.save();

    await assignFeesForClass(workspaceId, item.studentId, item.classId);

    await writeEnrollmentAudit({
      workspaceId,
      studentId: item.studentId,
      enrollmentId: String(newEnrollment._id),
      action: "PROMOTED",
      oldAcademicSessionId: input.fromSessionId,
      newAcademicSessionId: input.toSessionId,
      oldClassId,
      newClassId: item.classId,
      oldSectionId,
      newSectionId: item.sectionId,
      oldRollNumber,
      newRollNumber: item.rollNumber ?? "",
      oldPromotionStatus: currentEnrollment?.promotionStatus ?? "ENROLLED",
      newPromotionStatus: outcome === "NOT_PROMOTED" ? "NOT_PROMOTED" : "ENROLLED",
      reason: input.reason ?? "",
      changedBy: ctx.session.sub,
      changedByEmail: ctx.session.email,
    });

    promotedCount += 1;
  }

  return {
    message: `${promotedCount} student(s) processed successfully.`,
    promotedCount,
  };
}

export async function getAcademicHistory(ctx: TenantContext, filters: { studentId?: string; q?: string }) {
  const workspaceId = ctx.workspaceId;
  if (filters.studentId) {
    const history = await getStudentEnrollmentHistory(workspaceId, filters.studentId);
    const audits = await hydrateEnrollmentRows(workspaceId, history);
    const student = await Student.findOne({ _id: filters.studentId, workspaceId }).select("name admissionNumber").lean();
    return {
      student: student
        ? { _id: String(student._id), name: student.name, admissionNumber: student.admissionNumber }
        : null,
      enrollments: audits,
    };
  }

  const query: Record<string, unknown> = { workspaceId };
  if (filters.q?.trim()) {
    const term = filters.q.trim();
    const studentIds = await Student.find({
      workspaceId,
      $or: [{ name: { $regex: term, $options: "i" } }, { admissionNumber: { $regex: term, $options: "i" } }],
    }).distinct("_id");
    query.studentId = { $in: studentIds };
  }

  const rows = await StudentEnrollment.find(query).sort({ createdAt: -1 }).limit(500).lean();
  const studentIds = [...new Set(rows.map((row) => String(row.studentId)))];
  const students = await Student.find({ _id: { $in: studentIds } }).select("name admissionNumber").lean();
  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const hydrated = await hydrateEnrollmentRows(workspaceId, rows);

  return {
    rows: hydrated.map((row, index) => ({
      ...row,
      studentId: String(rows[index]?.studentId ?? ""),
      studentName: studentMap.get(String(rows[index]?.studentId))?.name ?? "",
      admissionNumber: studentMap.get(String(rows[index]?.studentId))?.admissionNumber ?? "",
    })),
  };
}

export async function listArchivedStudents(ctx: TenantContext) {
  const workspaceId = ctx.workspaceId;
  const students = await Student.find({
    workspaceId,
    status: { $in: ["ARCHIVED", "TRANSFERRED", "GRADUATED", "INACTIVE"] },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const sessionIds = [...new Set(students.map((row) => String(row.academicSessionId)).filter(Boolean))];
  const [classes, sections, sessions] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
    AcademicSession.find({ _id: { $in: sessionIds } }).select("name").lean(),
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const sessionMap = new Map(sessions.map((row) => [String(row._id), row.name]));

  return students.map((student) => ({
    _id: String(student._id),
    name: student.name,
    admissionNumber: student.admissionNumber,
    status: student.status,
    className: classMap.get(String(student.classId)) ?? "",
    sectionName: sectionMap.get(String(student.sectionId)) ?? "",
    academicSessionName: sessionMap.get(String(student.academicSessionId)) ?? "",
  }));
}

export async function autoGenerateRollNumbers(
  workspaceId: string,
  sectionId: string,
  studentIds: string[],
) {
  const existing = await StudentEnrollment.find({
    workspaceId,
    sectionId,
    rollNumber: { $ne: "" },
  })
    .select("rollNumber")
    .lean();
  let next = existing.reduce((max, row) => Math.max(max, Number.parseInt(row.rollNumber ?? "0", 10) || 0), 0);
  const map = new Map<string, string>();
  for (const studentId of studentIds) {
    next += 1;
    map.set(studentId, String(next));
  }
  return map;
}

export async function getStudentProfileEnrollment(ctx: TenantContext, studentId: string) {
  const workspaceId = ctx.workspaceId;
  const current = await getStudentCurrentEnrollment(workspaceId, studentId);
  const history = await getStudentEnrollmentHistory(workspaceId, studentId);
  const [currentHydrated, historyHydrated] = await Promise.all([
    current ? hydrateEnrollmentRows(workspaceId, [current as never]) : Promise.resolve([]),
    hydrateEnrollmentRows(workspaceId, history as never[]),
  ]);
  return {
    current: currentHydrated[0] ?? null,
    history: historyHydrated,
  };
}

export { createInitialEnrollment };
