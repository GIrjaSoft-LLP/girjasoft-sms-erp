import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/session";

function ownsStudent(ctx: TenantContext, studentId: string) {
  const { session } = ctx;
  if (isStudentLike(session.roleSlugs) && session.linkedStudentId === studentId) return true;
  if (isParentLike(session.roleSlugs) && (session.linkedStudentIds ?? []).includes(studentId)) return true;
  return false;
}

function ownsTeacher(ctx: TenantContext, teacherId: string) {
  return isTeacherLike(ctx.session.roleSlugs) && ctx.session.linkedTeacherId === teacherId;
}

export function assertCanManageStudentPhoto(ctx: TenantContext, studentId: string) {
  if (ctx.impersonating && isPlatformSuperAdmin(ctx.session)) return;
  if (hasPermission(ctx.session.permissions, "students.edit")) return;
  if (ownsStudent(ctx, studentId)) return;
  throw new ApiError(403, "Permission denied.");
}

export function assertCanManageTeacherPhoto(ctx: TenantContext, teacherId: string) {
  if (ctx.impersonating && isPlatformSuperAdmin(ctx.session)) return;
  if (hasPermission(ctx.session.permissions, "teachers.edit")) return;
  if (ownsTeacher(ctx, teacherId)) return;
  throw new ApiError(403, "Permission denied.");
}

export function visibleStudentFilter(ctx: TenantContext) {
  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
  };
  if (ctx.impersonating) return query;
  if (isStudentLike(ctx.session.roleSlugs)) {
    if (!ctx.session.linkedStudentId) throw new ApiError(403, "Student account is not linked.");
    query._id = new mongoose.Types.ObjectId(ctx.session.linkedStudentId);
  } else if (isParentLike(ctx.session.roleSlugs)) {
    const ids = (ctx.session.linkedStudentIds ?? []).map((id) => new mongoose.Types.ObjectId(id));
    if (!ids.length) throw new ApiError(403, "Parent account has no linked students.");
    query._id = { $in: ids };
  }
  return query;
}

export function visibleTeacherFilter(ctx: TenantContext) {
  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
  };
  if (ctx.impersonating) return query;
  if (isTeacherLike(ctx.session.roleSlugs) && !hasPermission(ctx.session.permissions, "teachers.edit")) {
    if (!ctx.session.linkedTeacherId) throw new ApiError(403, "Teacher account is not linked.");
    query._id = new mongoose.Types.ObjectId(ctx.session.linkedTeacherId);
  }
  return query;
}
