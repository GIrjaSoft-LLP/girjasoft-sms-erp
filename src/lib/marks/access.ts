import { ApiError, type TenantContext } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { getTeacherScopes } from "@/lib/attendance/scope";
import { resolveTeacherAssignmentScope } from "@/lib/teacher-scope";

export type MarksViewerMode = "admin" | "teacher" | "parent" | "student";

export function getMarksViewerMode(ctx: TenantContext): MarksViewerMode {
  if (ctx.impersonating || isWorkspaceAdmin(ctx)) return "admin";
  if (isTeacherLike(ctx.session.roleSlugs)) return "teacher";
  if (isParentLike(ctx.session.roleSlugs)) return "parent";
  if (isStudentLike(ctx.session.roleSlugs)) return "student";
  return "admin";
}

export function isMarksReadOnlyActor(ctx: TenantContext) {
  if (ctx.impersonating) return false;
  return isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs);
}

export function assertMarksMutationAllowed(ctx: TenantContext) {
  if (isMarksReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  if (
    !ctx.impersonating &&
    !hasPermission(ctx.permissions, "marks.create") &&
    !hasPermission(ctx.permissions, "marks.edit")
  ) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}

export function assertMarksCriteriaAllowed(ctx: TenantContext) {
  if (isMarksReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  if (getMarksViewerMode(ctx) === "admin") return;
  if (getMarksViewerMode(ctx) === "teacher" && hasPermission(ctx.permissions, "marks.edit")) return;
  if (hasPermission(ctx.permissions, "settings.edit")) return;
  throw new ApiError(403, "You do not have permission to perform this action.");
}

export async function assertTeacherCanScore(
  ctx: TenantContext,
  input: { classId?: string; sectionId?: string; subjectId?: string },
) {
  const scope = await resolveTeacherAssignmentScope(ctx);
  if (!scope.restricted) return;

  if (input.classId && !scope.classIds.has(input.classId)) {
    throw new ApiError(403, "You are not assigned to this class.");
  }
  if (input.sectionId && !scope.sectionIds.has(input.sectionId)) {
    throw new ApiError(403, "You are not assigned to this section.");
  }
  if (input.subjectId && ctx.session.linkedTeacherId) {
    const scopes = await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId);
    const isClassTeacher = scopes.classTeacher.some(
      (row) => row.classId === input.classId && (!input.sectionId || row.sectionId === input.sectionId),
    );
    if (!isClassTeacher && scope.subjectIds.size && !scope.subjectIds.has(input.subjectId)) {
      throw new ApiError(403, "You are not assigned to this subject.");
    }
  }
}

export async function teacherAllowedSubjectIds(
  ctx: TenantContext,
  classId: string,
  sectionId?: string,
): Promise<Set<string> | null> {
  const scope = await resolveTeacherAssignmentScope(ctx);
  if (!scope.restricted || !ctx.session.linkedTeacherId) return null;
  const scopes = await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId);
  const isClassTeacher = scopes.classTeacher.some(
    (row) => row.classId === classId && (!sectionId || row.sectionId === sectionId),
  );
  if (isClassTeacher) return null;
  return scope.subjectIds;
}
