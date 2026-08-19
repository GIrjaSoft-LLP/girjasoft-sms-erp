import { ApiError, requirePerm, requireWorkspaceContext, type TenantContext } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike } from "@/lib/rbac";

export function assertStaffAttendanceManagement(ctx: TenantContext) {
  if (isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs)) {
    throw new ApiError(403, "You do not have permission to manage attendance.");
  }
}

export async function requireAttendanceContext(permission: string): Promise<TenantContext> {
  const ctx = await requireWorkspaceContext();
  if (!ctx.enabledModules.includes("attendance")) {
    throw new ApiError(403, "Attendance module is not enabled for your school.");
  }
  if (!hasPermission(ctx.permissions, permission) && isParentLike(ctx.session.roleSlugs)) {
    if (permission === "attendance.view" && hasPermission(ctx.permissions, "students.view")) {
      return ctx;
    }
  }
  requirePerm(ctx, permission);
  return ctx;
}
