import { ApiError, type TenantContext } from "@/lib/api/guards";
import { hasPermission } from "@/lib/rbac";
import { isPlatformActor } from "@/lib/session";
import { canViewSchoolTicket } from "@/lib/ticket-routing";

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

export function assertCanViewSchoolTicket(
  ctx: TenantContext,
  ticket: {
    createdByUserId?: string;
    createdByRole?: string;
    ticketRoute?: string;
    workspaceId?: unknown;
  },
) {
  if (!canViewSchoolTicket(ctx, ticket)) {
    throw new ApiError(404, "Ticket not found.");
  }
}

export function canSetCritical(ctx: TenantContext) {
  if (ctx.impersonating && isPlatformActor(ctx.session)) return true;
  return Boolean(
    ctx.session.roleSlugs?.includes("workspace_admin") || hasPermission(ctx.session.permissions, "settings.edit"),
  );
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
