import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";

export type ResultsViewerMode = "admin" | "teacher" | "parent" | "student";

export function getResultsViewerMode(ctx: TenantContext): ResultsViewerMode {
  if (ctx.impersonating || isWorkspaceAdmin(ctx)) return "admin";
  if (isTeacherLike(ctx.session.roleSlugs)) return "teacher";
  if (isParentLike(ctx.session.roleSlugs)) return "parent";
  if (isStudentLike(ctx.session.roleSlugs)) return "student";
  return "admin";
}

export function isResultsReadOnlyActor(ctx: TenantContext) {
  if (ctx.impersonating) return false;
  return isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs);
}

export function assertResultsMutationAllowed(ctx: TenantContext) {
  if (isResultsReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}
