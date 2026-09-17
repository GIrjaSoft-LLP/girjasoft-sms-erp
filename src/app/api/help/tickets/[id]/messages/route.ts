import { NextRequest } from "next/server";
import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertSchoolHelp, assertCanViewSchoolTicket, publicTicket } from "@/lib/ticket-access";
import { saveTicketFile } from "@/lib/ticket-files";
import { notifySchoolUser, notifyWorkspaceUsersByRoles } from "@/lib/ticket-notify";
import { isWorkspaceRoutedTicket, notifyRoleSlugsForTicket } from "@/lib/ticket-routing";
import { SupportTicket } from "@/models/support";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    assertSchoolHelp(tenant);
    const { id } = await ctx.params;
    const ticket = await SupportTicket.findOne({ _id: id, workspaceId: tenant.workspaceId });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    assertCanViewSchoolTicket(tenant, ticket);
    if (ticket.status === "CLOSED") {
      throw new ApiError(400, "This ticket is closed. Reopen it to add a reply.");
    }

    const contentType = request.headers.get("content-type") ?? "";
    let body = "";
    let file: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = String(form.get("body") ?? "").trim();
      const uploaded = form.get("file");
      if (uploaded instanceof File && uploaded.size > 0) file = uploaded;
    } else {
      const jsonBody = (await request.json()) as { body?: string };
      body = String(jsonBody.body ?? "").trim();
    }
    if (!body && !file) throw new ApiError(400, "Enter a reply or attach a file.");

    const attachments = [];
    if (file) {
      try {
        attachments.push(await saveTicketFile(tenant.workspaceId, id, file));
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Attachment failed");
      }
    }

    ticket.messages.push({
      authorType: "SCHOOL",
      authorId: tenant.session.sub,
      authorName: tenant.session.name,
      body: body || "Attachment added.",
      visibility: "PUBLIC",
      attachments,
    });
    ticket.events.push({
      action: "Reply Added",
      actorName: tenant.session.name,
      actorType: "SCHOOL",
      detail: body.slice(0, 80),
    });
    ticket.unreadForPlatform = !isWorkspaceRoutedTicket(ticket);
    ticket.unreadForSchool = isWorkspaceRoutedTicket(ticket) && ticket.createdByUserId !== tenant.session.sub;
    if (ticket.status === "RESOLVED" || ticket.status === "WAITING_FOR_SCHOOL") {
      ticket.status = "IN_PROGRESS";
      ticket.events.push({
        action: "Status Changed",
        actorName: tenant.session.name,
        actorType: "SCHOOL",
        detail: "IN_PROGRESS",
      });
    }
    await ticket.save();
    await logWorkspace(tenant.session, tenant.workspaceId, "ticket.reply", "tickets", id);
    if (isWorkspaceRoutedTicket(ticket)) {
      if (ticket.createdByUserId === tenant.session.sub) {
        await notifyWorkspaceUsersByRoles(
          tenant.workspaceId,
          notifyRoleSlugsForTicket(ticket),
          `New reply on ${ticket.ticketNumber}`,
          body.slice(0, 140) || ticket.subject,
          tenant.session.sub,
        );
      } else {
        await notifySchoolUser(
          tenant.workspaceId,
          ticket.createdByUserId,
          `New reply on ${ticket.ticketNumber}`,
          body.slice(0, 140) || ticket.subject,
        );
      }
    }
    return json({ item: publicTicket(ticket.toObject() as Record<string, unknown>, true) });
  } catch (error) {
    return errorResponse(error);
  }
}
