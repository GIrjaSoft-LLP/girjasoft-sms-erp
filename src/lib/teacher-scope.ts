import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { getTeacherScopes } from "@/lib/attendance/scope";
import { Student } from "@/models/workspace";

export type TeacherAssignmentScope = {
  restricted: boolean;
  classIds: Set<string>;
  sectionIds: Set<string>;
  subjectIds: Set<string>;
};

const CLASS_SCOPED_RESOURCES = new Set([
  "homework",
  "timetable",
  "attendance",
  "exams",
  "examSchedules",
  "teacherAttendance",
]);

const STUDENT_SCOPED_RESOURCES = new Set([
  "marks",
  "results",
  "fees",
  "payments",
  "bookIssues",
  "transportAssignments",
]);

export function shouldRestrictTeacherAccess(ctx: TenantContext) {
  if (ctx.impersonating) return false;
  if (!isTeacherLike(ctx.session.roleSlugs)) return false;
  if (isWorkspaceAdmin(ctx)) return false;
  return Boolean(ctx.session.linkedTeacherId);
}

export async function resolveTeacherAssignmentScope(ctx: TenantContext): Promise<TeacherAssignmentScope> {
  if (!shouldRestrictTeacherAccess(ctx)) {
    return {
      restricted: false,
      classIds: new Set(),
      sectionIds: new Set(),
      subjectIds: new Set(),
    };
  }

  const scopes = await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId);
  const classIds = new Set<string>();
  const sectionIds = new Set<string>();
  const subjectIds = new Set<string>();

  for (const item of scopes.classTeacher) {
    classIds.add(item.classId);
    sectionIds.add(item.sectionId);
  }
  for (const item of scopes.subjectTeacher) {
    classIds.add(item.classId);
    if (item.sectionId) sectionIds.add(item.sectionId);
    subjectIds.add(item.subjectId);
  }

  return { restricted: true, classIds, sectionIds, subjectIds };
}

function toObjectIds(ids: Set<string>) {
  return [...ids].map((id) => new mongoose.Types.ObjectId(id));
}

function denyAll(query: Record<string, unknown>) {
  query._id = { $in: [] };
}

export function assertTeacherScopeAllowed(
  scope: TeacherAssignmentScope,
  input: { classId?: string | null; sectionId?: string | null; subjectId?: string | null },
) {
  if (!scope.restricted) return;

  if (!scope.classIds.size && !scope.sectionIds.size) {
    throw new ApiError(403, "No classes are assigned to your account.");
  }

  if (input.classId && !scope.classIds.has(input.classId)) {
    throw new ApiError(403, "You are not assigned to this class.");
  }
  if (input.sectionId && !scope.sectionIds.has(input.sectionId)) {
    throw new ApiError(403, "You are not assigned to this section.");
  }
  if (input.subjectId && scope.subjectIds.size > 0 && !scope.subjectIds.has(input.subjectId)) {
    throw new ApiError(403, "You are not assigned to this subject.");
  }
}

export async function assertTeacherStudentAccess(
  ctx: TenantContext,
  scope: TeacherAssignmentScope,
  studentId: string,
) {
  if (!scope.restricted) return;
  const student = await Student.findOne({
    workspaceId: ctx.workspaceId,
    _id: studentId,
  })
    .select("sectionId classId")
    .lean();
  if (!student) throw new ApiError(404, "Student not found.");
  assertTeacherScopeAllowed(scope, {
    classId: student.classId ? String(student.classId) : undefined,
    sectionId: student.sectionId ? String(student.sectionId) : undefined,
  });
}

export async function applyTeacherScopeToQuery(
  ctx: TenantContext,
  resource: string,
  query: Record<string, unknown>,
  scope: TeacherAssignmentScope,
) {
  if (!scope.restricted) return query;

  if (!scope.classIds.size && !scope.sectionIds.size) {
    denyAll(query);
    return query;
  }

  const classObjectIds = toObjectIds(scope.classIds);
  const sectionObjectIds = toObjectIds(scope.sectionIds);

  switch (resource) {
    case "classes":
      query._id = { $in: classObjectIds };
      break;
    case "sections":
      query._id = { $in: sectionObjectIds };
      break;
    case "subjects":
      query.classId = { $in: classObjectIds };
      break;
    case "students":
      query.sectionId = { $in: sectionObjectIds };
      break;
    case "homework":
    case "timetable":
    case "attendance":
    case "exams":
    case "examSchedules":
    case "teacherAttendance":
      query.classId = { $in: classObjectIds };
      break;
    case "marks":
    case "results":
    case "fees":
    case "payments":
    case "bookIssues":
    case "transportAssignments": {
      const studentIds = await Student.find({
        workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
        sectionId: { $in: sectionObjectIds },
      }).distinct("_id");
      query.studentId = { $in: studentIds };
      break;
    }
    default:
      break;
  }

  return query;
}

export function assertTeacherRecordAccess(
  scope: TeacherAssignmentScope,
  resource: string,
  record: Record<string, unknown>,
) {
  if (!scope.restricted) return;

  if (resource === "classes") {
    assertTeacherScopeAllowed(scope, { classId: String(record._id) });
    return;
  }
  if (resource === "sections") {
    assertTeacherScopeAllowed(scope, { sectionId: String(record._id) });
    return;
  }
  if (resource === "students") {
    assertTeacherScopeAllowed(scope, {
      classId: record.classId ? String(record.classId) : undefined,
      sectionId: record.sectionId ? String(record.sectionId) : undefined,
    });
    return;
  }
  if (resource === "subjects") {
    assertTeacherScopeAllowed(scope, {
      classId: record.classId ? String(record.classId) : undefined,
    });
    return;
  }
  if (CLASS_SCOPED_RESOURCES.has(resource)) {
    assertTeacherScopeAllowed(scope, {
      classId: record.classId ? String(record.classId) : undefined,
      sectionId: record.sectionId ? String(record.sectionId) : undefined,
      subjectId: record.subjectId ? String(record.subjectId) : undefined,
    });
  }
}

export async function assertTeacherWritePayload(
  ctx: TenantContext,
  scope: TeacherAssignmentScope,
  resource: string,
  body: Record<string, unknown>,
) {
  if (!scope.restricted) return;

  assertTeacherScopeAllowed(scope, {
    classId: body.classId ? String(body.classId) : undefined,
    sectionId: body.sectionId ? String(body.sectionId) : undefined,
    subjectId: body.subjectId ? String(body.subjectId) : undefined,
  });

  if (body.studentId) {
    await assertTeacherStudentAccess(ctx, scope, String(body.studentId));
  }

  if (resource === "timetable" && body.teacherId && ctx.session.linkedTeacherId) {
    if (String(body.teacherId) !== ctx.session.linkedTeacherId) {
      throw new ApiError(403, "You can only manage your own timetable entries.");
    }
  }
}

export async function assertTeacherRecordAllowed(
  ctx: TenantContext,
  scope: TeacherAssignmentScope,
  resource: string,
  record: Record<string, unknown>,
) {
  if (!scope.restricted) return;
  assertTeacherRecordAccess(scope, resource, record);
  if (STUDENT_SCOPED_RESOURCES.has(resource) && record.studentId) {
    await assertTeacherStudentAccess(ctx, scope, String(record.studentId));
  }
}
