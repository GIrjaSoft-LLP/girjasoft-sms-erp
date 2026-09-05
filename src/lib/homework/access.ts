import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike } from "@/lib/rbac";
import { resolveLinkedStudentClassScope } from "@/lib/exams/access";

function denyAll(query: Record<string, unknown>) {
  query._id = { $in: [] };
}

export function isHomeworkReadOnlyActor(ctx: TenantContext) {
  if (ctx.impersonating) return false;
  return isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs);
}

export function assertHomeworkMutationAllowed(ctx: TenantContext) {
  if (isHomeworkReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}

export async function applyFamilyHomeworkVisibility(
  ctx: TenantContext,
  resource: string,
  query: Record<string, unknown>,
) {
  if (ctx.impersonating) return;
  if (resource !== "homework") return;
  if (!isParentLike(ctx.session.roleSlugs) && !isStudentLike(ctx.session.roleSlugs)) return;

  const scope = await resolveLinkedStudentClassScope(ctx);
  if (!scope) {
    denyAll(query);
    return;
  }
  query.classId = new mongoose.Types.ObjectId(scope.classId);
  if (scope.sectionId) {
    query.sectionId = new mongoose.Types.ObjectId(scope.sectionId);
  }
}

export async function assertHomeworkVisibleToFamily(
  ctx: TenantContext,
  record: { classId?: unknown; sectionId?: unknown },
) {
  if (ctx.impersonating) return;
  if (!isParentLike(ctx.session.roleSlugs) && !isStudentLike(ctx.session.roleSlugs)) return;

  const scope = await resolveLinkedStudentClassScope(ctx);
  if (!scope) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const classId = record.classId ? String(record.classId) : "";
  const sectionId = record.sectionId ? String(record.sectionId) : "";
  if (classId && classId !== scope.classId) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  if (scope.sectionId && sectionId && sectionId !== scope.sectionId) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}
