import { NextRequest } from "next/server";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/config/tickets";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { notifySchoolUser } from "@/lib/ticket-notify";
import { SupportTicket } from "@/models/support";
import { PlatformAdmin } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformPerm("platform.tickets.view");
    const { id } = await ctx.params;
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.unreadForPlatform) {
      ticket.unreadForPlatform = false;
      await ticket.save();
    }
    const admins = await PlatformAdmin.find({ status: "ACTIVE" }).select("name email").lean();
    return json({
      item: ticket,
      admins: admins.map((row) => ({ id: String(row._id), name: row.name, email: row.email })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.tickets.edit");
    const { id } = await ctx.params;
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    const body = (await request.json()) as {
      status?: string;
      priority?: string;
      assignedToId?: string;
      resolution?: string;
    };

    if (body.priority && TICKET_PRIORITIES.includes(body.priority as (typeof TICKET_PRIORITIES)[number])) {
      if (ticket.priority !== body.priority) {
        ticket.events.push({
          action: "Priority Changed",
          actorName: session.name,
          actorType: "PLATFORM",
          detail: `${ticket.priority} → ${body.priority}`,
        });
        ticket.priority = body.priority;
        ticket.unreadForSchool = true;
      }
    }

    if (body.assignedToId !== undefined) {
      const admin = body.assignedToId
        ? await PlatformAdmin.findById(body.assignedToId).select("name")
        : null;
      ticket.assignedToId = admin ? String(admin._id) : "";
      ticket.assignedToName = admin?.name ?? "";
      ticket.assignedAt = admin ? new Date() : null;
      if (admin && ticket.status === "OPEN") ticket.status = "ASSIGNED";
      ticket.events.push({
        action: "Ticket Assigned",
        actorName: session.name,
        actorType: "PLATFORM",
        detail: admin?.name ?? "Unassigned",
      });
      ticket.unreadForSchool = true;
    }

    if (body.resolution !== undefined) {
      ticket.resolution = String(body.resolution ?? "");
    }

    if (body.status && TICKET_STATUSES.includes(body.status as (typeof TICKET_STATUSES)[number])) {
      if (ticket.status !== body.status) {
        if (body.status === "RESOLVED" && !ticket.resolution.trim()) {
          throw new ApiError(400, "Add a resolution message before resolving the ticket.");
        }
        ticket.events.push({
          action: body.status === "RESOLVED" ? "Ticket Resolved" : body.status === "CLOSED" ? "Ticket Closed" : "Status Changed",
          actorName: session.name,
          actorType: "PLATFORM",
          detail: body.status,
        });
        ticket.status = body.status;
        ticket.unreadForSchool = true;
        await notifySchoolUser(
          String(ticket.workspaceId),
          ticket.createdByUserId,
          `Ticket ${ticket.ticketNumber} ${body.status.toLowerCase().replace("_", " ")}`,
          ticket.subject,
        );
      }
    }

    await ticket.save();
    await logPlatform(session, "ticket.update", { ticketNumber: ticket.ticketNumber, status: ticket.status });
    return json({ item: ticket });
  } catch (error) {
    return errorResponse(error);
  }
}
