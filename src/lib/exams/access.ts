import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { getTeacherScopes } from "@/lib/attendance/scope";
import { resolveLinkedStudentIds } from "@/lib/parent-access";
import { Student } from "@/models/workspace";

export type ExamViewerMode = "admin" | "teacher" | "parent" | "student";

export function getExamViewerMode(ctx: TenantContext): ExamViewerMode {
  if (ctx.impersonating || isWorkspaceAdmin(ctx)) return "admin";
  if (isTeacherLike(ctx.session.roleSlugs)) return "teacher";
  if (isParentLike(ctx.session.roleSlugs)) return "parent";
  if (isStudentLike(ctx.session.roleSlugs)) return "student";
  return "admin";
}

function denyAll(query: Record<string, unknown>) {
  query._id = { $in: [] };
}

export async function resolveLinkedStudentClassScope(ctx: TenantContext) {
  const { session } = ctx;
  let studentId = "";
  if (isStudentLike(session.roleSlugs)) {
    studentId = session.linkedStudentId ?? "";
  } else if (isParentLike(session.roleSlugs)) {
    const linked = await resolveLinkedStudentIds(session, ctx.workspaceId);
    studentId =
      session.linkedStudentId && linked.includes(String(session.linkedStudentId))
        ? String(session.linkedStudentId)
        : linked[0] ?? "";
  }
  if (!studentId) return null;

  const student = await Student.findOne({
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    _id: studentId,
  })
    .select("name classId sectionId")
    .lean();
  if (!student?.classId) return null;

  return {
    studentId: String(student._id),
    studentName: student.name ?? "",
    classId: String(student.classId),
    sectionId: student.sectionId ? String(student.sectionId) : "",
  };
}

export async function applyFamilyExamVisibility(
  ctx: TenantContext,
  resource: string,
  query: Record<string, unknown>,
) {
  if (ctx.impersonating) return;
  if (resource !== "exams" && resource !== "examSchedules") return;
  if (!isParentLike(ctx.session.roleSlugs) && !isStudentLike(ctx.session.roleSlugs)) return;

  const scope = await resolveLinkedStudentClassScope(ctx);
  if (!scope) {
    denyAll(query);
    return;
  }
  query.classId = new mongoose.Types.ObjectId(scope.classId);
}

export async function applyTeacherExamScheduleScope(
  ctx: TenantContext,
  query: Record<string, unknown>,
  classObjectIds: mongoose.Types.ObjectId[],
) {
  if (!ctx.session.linkedTeacherId) {
    denyAll(query);
    return;
  }

  const scopes = await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId);
  const classTeacherClassIds = new Set(scopes.classTeacher.map((row) => row.classId));
  const orClauses: Array<Record<string, unknown>> = [];

  if (classTeacherClassIds.size) {
    orClauses.push({
      classId: {
        $in: [...classTeacherClassIds].map((id) => new mongoose.Types.ObjectId(id)),
      },
    });
  }

  const subjectOnly = scopes.subjectTeacher.filter((row) => !classTeacherClassIds.has(row.classId));
  if (subjectOnly.length) {
    const classIds = [...new Set(subjectOnly.map((row) => row.classId))];
    const subjectIds = [...new Set(subjectOnly.map((row) => row.subjectId))];
    orClauses.push({
      classId: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
      subjectId: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  if (!orClauses.length) {
    query.classId = { $in: classObjectIds };
    return;
  }
  if (orClauses.length === 1) {
    Object.assign(query, orClauses[0]);
    return;
  }
  query.$or = orClauses;
}

export function formatScheduleDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", { weekday: "long" });
}

export function formatScheduleTime(time: string) {
  if (!time) return "—";
  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}
