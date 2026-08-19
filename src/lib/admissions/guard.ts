import { ApiError, requirePerm, requireWorkspaceContext, type TenantContext } from "@/lib/api/guards";

export async function requireAdmissionContext(permission: string): Promise<TenantContext> {
  const ctx = await requireWorkspaceContext();
  if (!ctx.enabledModules.includes("admissions")) {
    throw new ApiError(403, "Admission module is not enabled for your school.");
  }
  requirePerm(ctx, permission);
  return ctx;
}
