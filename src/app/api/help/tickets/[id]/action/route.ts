import { NextRequest } from "next/server";
import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertSchoolHelp, publicTicket } from "@/lib/ticket-access";
import { SupportTicket } from "@/models/support";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    assertSchoolHelp(tenant);
    const { id } = await ctx.params;
    const { action } = (await request.json()) as { action?: string };
    const ticket = await SupportTicket.findOne({ _id: id, workspaceId: tenant.workspaceId });
    if (!ticket) throw new ApiError(404, "Ticket not found.");

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
      ticket.unreadForPlatform = true;
      ticket.events.push({
        action: "Ticket Reopened",
        actorName: tenant.session.name,
        actorType: "SCHOOL",
        detail: "",
      });
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
