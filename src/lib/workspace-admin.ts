import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPlatformPermission } from "@/lib/platform-access";

export function isWorkspaceAdmin(ctx: TenantContext) {
  if (ctx.session.roleSlugs?.includes("workspace_admin")) return true;
  if (ctx.impersonating && hasPlatformPermission(ctx.session, "platform.workspaces.manage")) return true;
  return false;
}

export function requireWorkspaceAdmin(ctx: TenantContext) {
  if (!isWorkspaceAdmin(ctx)) {
    throw new ApiError(403, "Admin access required.");
  }
}
