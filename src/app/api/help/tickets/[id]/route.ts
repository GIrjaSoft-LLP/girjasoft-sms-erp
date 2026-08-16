import { NextRequest } from "next/server";
import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { assertSchoolHelp, publicTicket } from "@/lib/ticket-access";
import { SupportTicket } from "@/models/support";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    assertSchoolHelp(tenant);
    const { id } = await ctx.params;
    const ticket = await SupportTicket.findOne({ _id: id, workspaceId: tenant.workspaceId });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.unreadForSchool) {
      ticket.unreadForSchool = false;
      await ticket.save();
    }
    return json({ item: publicTicket(ticket.toObject() as Record<string, unknown>, true) });
  } catch (error) {
    return errorResponse(error);
  }
}
