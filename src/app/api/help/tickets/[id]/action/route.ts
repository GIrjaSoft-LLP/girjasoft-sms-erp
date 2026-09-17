import { NextRequest } from "next/server";
import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertSchoolHelp, assertCanViewSchoolTicket, publicTicket } from "@/lib/ticket-access";
import { notifySchoolUser } from "@/lib/ticket-notify";
import { canManageWorkspaceTicket, isWorkspaceRoutedTicket } from "@/lib/ticket-routing";
import { SupportTicket } from "@/models/support";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    assertSchoolHelp(tenant);
    const { id } = await ctx.params;
    const { action, resolution } = (await request.json()) as { action?: string; resolution?: string };
    const ticket = await SupportTicket.findOne({ _id: id, workspaceId: tenant.workspaceId });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    assertCanViewSchoolTicket(tenant, ticket);

    if (action === "confirm") {
      if (ticket.status !== "RESOLVED") throw new ApiError(400, "Only resolved tickets can be confirmed.");
      ticket.status = "CLOSED";
      ticket.events.push({
        action: "Ticket Closed",
        actorName: tenant.session.name,
        actorType: "SCHOOL",
        detail: "School confirmed resolution",
      });
    } else if (action === "reopen") {
      if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
        throw new ApiError(400, "Only resolved or closed tickets can be reopened.");
      }
      ticket.status = "OPEN";
      ticket.unreadForPlatform = !isWorkspaceRoutedTicket(ticket);
      ticket.unreadForSchool = isWorkspaceRoutedTicket(ticket);
      ticket.events.push({
        action: "Ticket Reopened",
        actorName: tenant.session.name,
        actorType: "SCHOOL",
        detail: "",
      });
    } else if (action === "resolve") {
      if (!canManageWorkspaceTicket(tenant, ticket)) {
        throw new ApiError(403, "Permission denied.");
      }
      if (ticket.status === "CLOSED") throw new ApiError(400, "This ticket is closed.");
      ticket.resolution = String(resolution ?? ticket.resolution ?? "").trim();
      if (!ticket.resolution) throw new ApiError(400, "Add a resolution message before resolving the ticket.");
      ticket.status = "RESOLVED";
      ticket.unreadForSchool = ticket.createdByUserId !== tenant.session.sub;
      ticket.events.push({
        action: "Ticket Resolved",
        actorName: tenant.session.name,
        actorType: "SCHOOL",
        detail: ticket.resolution.slice(0, 80),
      });
      if (ticket.createdByUserId !== tenant.session.sub) {
        await notifySchoolUser(
          tenant.workspaceId,
          ticket.createdByUserId,
          `Ticket ${ticket.ticketNumber} resolved`,
          ticket.subject,
        );
      }
    } else {
      throw new ApiError(400, "Unknown action.");
    }

    await ticket.save();
    await logWorkspace(tenant.session, tenant.workspaceId, `ticket.${action}`, "tickets", id);
    return json({ item: publicTicket(ticket.toObject() as Record<string, unknown>, true) });
  } catch (error) {
    return errorResponse(error);
  }
}
