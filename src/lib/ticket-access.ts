import { ApiError, type TenantContext } from "@/lib/api/guards";
import { hasPermission } from "@/lib/rbac";
import { isPlatformActor } from "@/lib/session";

export function canUseSchoolHelp(ctx: TenantContext) {
  if (ctx.impersonating && isPlatformActor(ctx.session)) return true;
  if (hasPermission(ctx.session.permissions, "tickets.view")) return true;
  if (hasPermission(ctx.session.permissions, "tickets.create")) return true;
  if (ctx.session.roleSlugs?.includes("workspace_admin")) return true;
  return hasPermission(ctx.session.permissions, "profile.view");
}

export function assertSchoolHelp(ctx: TenantContext) {
  if (!canUseSchoolHelp(ctx)) throw new ApiError(403, "Permission denied.");
}

export function canSetCritical(ctx: TenantContext) {
  if (ctx.impersonating && isPlatformActor(ctx.session)) return true;
  return Boolean(ctx.session.roleSlugs?.includes("workspace_admin") || hasPermission(ctx.session.permissions, "settings.edit"));
}

export function publicTicket(ticket: Record<string, unknown>, forSchool: boolean) {
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  return {
    ...ticket,
    messages: forSchool
      ? messages.filter((row) => (row as { visibility?: string }).visibility !== "INTERNAL")
      : messages,
  };
}
