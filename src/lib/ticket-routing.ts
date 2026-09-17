import mongoose from "mongoose";
import type { TenantContext } from "@/lib/api/guards";

export const PLATFORM_TICKET_ROLES = [
  "workspace_admin",
  "accountant",
  "hr_manager",
  "librarian",
  "transport_manager",
] as const;

export const SCHOOL_SUPPORT_ROLES = PLATFORM_TICKET_ROLES;

export const SCHOOL_STAFF_ROLES = [...SCHOOL_SUPPORT_ROLES, "teacher"] as const;

export type TicketRoute = "PLATFORM" | "WORKSPACE";

type TicketLike = {
  createdByUserId?: string;
  createdByRole?: string;
  ticketRoute?: string;
  workspaceId?: unknown;
};

function slugList(roleSlugs: string[] | undefined) {
  return (roleSlugs ?? []).map((slug) => slug.toLowerCase());
}

export function routingRole(roleSlugs: string[] | undefined, fallback = "") {
  const slugs = slugList(roleSlugs);
  const platformRole = PLATFORM_TICKET_ROLES.find((role) => slugs.includes(role));
  if (platformRole) return platformRole;
  if (slugs.includes("teacher")) return "teacher";
  if (slugs.includes("parent")) return "parent";
  return slugs[0] || fallback;
}

export function ticketRouteForRoles(roleSlugs: string[] | undefined): TicketRoute {
  const role = routingRole(roleSlugs);
  return (PLATFORM_TICKET_ROLES as readonly string[]).includes(role) ? "PLATFORM" : "WORKSPACE";
}

export function isSchoolSupport(roleSlugs: string[] | undefined) {
  return slugList(roleSlugs).some((slug) => (SCHOOL_SUPPORT_ROLES as readonly string[]).includes(slug));
}

export function isSchoolStaff(roleSlugs: string[] | undefined) {
  return slugList(roleSlugs).some((slug) => (SCHOOL_STAFF_ROLES as readonly string[]).includes(slug));
}

export function isWorkspaceRoutedTicket(ticket: TicketLike) {
  if (ticket.ticketRoute === "WORKSPACE") return true;
  if (ticket.ticketRoute === "PLATFORM") return false;
  const role = String(ticket.createdByRole ?? "").toLowerCase();
  return role === "teacher" || role === "parent";
}

export function creatorAudience(ticket: TicketLike) {
  const role = String(ticket.createdByRole ?? "").toLowerCase();
  if (role === "parent") return "parent" as const;
  if (role === "teacher") return "teacher" as const;
  return "other" as const;
}

export function platformTicketQuery(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    $nor: [{ ticketRoute: "WORKSPACE" }, { createdByRole: { $in: ["teacher", "parent"] } }],
  };
}

export function schoolTicketVisibilityQuery(
  workspaceId: string,
  userId: string,
  roleSlugs: string[] | undefined,
) {
  const clauses: Record<string, unknown>[] = [{ createdByUserId: userId }];
  if (isSchoolSupport(roleSlugs)) {
    clauses.push({ ticketRoute: "WORKSPACE" });
    clauses.push({ createdByRole: { $in: ["teacher", "parent"] }, ticketRoute: { $ne: "PLATFORM" } });
  } else if (slugList(roleSlugs).includes("teacher")) {
    clauses.push({ ticketRoute: "WORKSPACE", createdByRole: "parent" });
    clauses.push({ createdByRole: "parent", ticketRoute: { $ne: "PLATFORM" } });
  }
  return {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    $or: clauses,
  };
}

export function canViewSchoolTicket(ctx: TenantContext, ticket: TicketLike) {
  if (String(ticket.workspaceId) !== ctx.workspaceId) return false;
  if (String(ticket.createdByUserId) === ctx.session.sub) return true;
  if (!isWorkspaceRoutedTicket(ticket)) return false;
  const audience = creatorAudience(ticket);
  if (audience === "parent") return isSchoolStaff(ctx.session.roleSlugs);
  return isSchoolSupport(ctx.session.roleSlugs);
}

export function canManageWorkspaceTicket(ctx: TenantContext, ticket: TicketLike) {
  if (!isWorkspaceRoutedTicket(ticket)) return false;
  if (String(ticket.workspaceId) !== ctx.workspaceId) return false;
  const audience = creatorAudience(ticket);
  if (audience === "parent") return isSchoolStaff(ctx.session.roleSlugs);
  return isSchoolSupport(ctx.session.roleSlugs);
}

export function notifyRoleSlugsForTicket(ticket: TicketLike) {
  if (!isWorkspaceRoutedTicket(ticket)) return [] as string[];
  return creatorAudience(ticket) === "parent" ? [...SCHOOL_STAFF_ROLES] : [...SCHOOL_SUPPORT_ROLES];
}
