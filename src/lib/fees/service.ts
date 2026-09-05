import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike } from "@/lib/rbac";
import { assertTeacherScopeAllowed, resolveTeacherAssignmentScope } from "@/lib/teacher-scope";
import { SchoolClass, Section, Student, StudentFee } from "@/models/workspace";

const FEE_STATUSES = ["PENDING", "PARTIAL", "PAID"] as const;

export const createClassFeesSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1),
  amount: z.number().positive(),
  description: z.string().trim().default(""),
  dueDate: z.string().trim().default(""),
  status: z.enum(FEE_STATUSES).default("PENDING"),
});

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function listFeeStudents(ctx: TenantContext, classId: string, sectionId: string) {
  if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(sectionId)) {
    throw new ApiError(400, "Select a valid class and section.");
  }
  const scope = await resolveTeacherAssignmentScope(ctx);
  assertTeacherScopeAllowed(scope, { classId, sectionId });

  const [classDoc, sectionDoc, students] = await Promise.all([
    SchoolClass.findOne({ _id: classId, workspaceId: oid(ctx.workspaceId) }).select("name").lean(),
    Section.findOne({ _id: sectionId, workspaceId: oid(ctx.workspaceId), classId }).select("name").lean(),
    Student.find({
      workspaceId: oid(ctx.workspaceId),
      classId,
      sectionId,
      status: { $ne: "INACTIVE" },
    })
      .sort({ name: 1 })
      .select("name admissionNumber")
      .lean(),
  ]);
  if (!classDoc || !sectionDoc) throw new ApiError(400, "Class or section was not found.");

  return {
    className: classDoc.name,
    sectionName: sectionDoc.name,
    students: students.map((row) => ({
      _id: String(row._id),
      name: row.name,
      admissionNumber: row.admissionNumber ?? "",
    })),
  };
}

export async function createClassStudentFees(ctx: TenantContext, raw: unknown) {
  if (isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  if (!ctx.impersonating && !hasPermission(ctx.permissions, "fees.create")) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  const input = createClassFeesSchema.parse(raw);
  const scope = await resolveTeacherAssignmentScope(ctx);
  assertTeacherScopeAllowed(scope, { classId: input.classId, sectionId: input.sectionId });

  const students = await Student.find({
    workspaceId: oid(ctx.workspaceId),
    _id: { $in: input.studentIds.map((id) => oid(id)) },
    classId: oid(input.classId),
    sectionId: oid(input.sectionId),
    status: { $ne: "INACTIVE" },
  })
    .select("_id")
    .lean();
  if (!students.length) throw new ApiError(400, "No matching students were found in this class and section.");
  if (students.length !== input.studentIds.length) {
    throw new ApiError(400, "One or more selected students do not belong to the selected class and section.");
  }

  const docs = students.map((student) => ({
    workspaceId: oid(ctx.workspaceId),
    studentId: student._id,
    amount: input.amount,
    description: input.description,
    dueDate: input.dueDate,
    status: input.status,
    paidAmount: input.status === "PAID" ? input.amount : 0,
  }));
  await StudentFee.insertMany(docs);
  return { created: docs.length };
}
