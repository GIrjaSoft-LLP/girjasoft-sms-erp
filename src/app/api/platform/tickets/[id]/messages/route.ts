import { NextRequest } from "next/server";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { saveTicketFile } from "@/lib/ticket-files";
import { notifySchoolUser } from "@/lib/ticket-notify";
import { isWorkspaceRoutedTicket } from "@/lib/ticket-routing";
import { SupportTicket } from "@/models/support";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.tickets.edit");
    const { id } = await ctx.params;
    const ticket = await SupportTicket.findById(id);
    if (!ticket || isWorkspaceRoutedTicket(ticket)) throw new ApiError(404, "Ticket not found.");

    const contentType = request.headers.get("content-type") ?? "";
    let body = "";
    let visibility = "PUBLIC";
    let file: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = String(form.get("body") ?? "").trim();
      visibility = String(form.get("visibility") ?? "PUBLIC") === "INTERNAL" ? "INTERNAL" : "PUBLIC";
      const uploaded = form.get("file");
      if (uploaded instanceof File && uploaded.size > 0) file = uploaded;
    } else {
      const jsonBody = (await request.json()) as { body?: string; visibility?: string };
      body = String(jsonBody.body ?? "").trim();
      visibility = jsonBody.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC";
    }
    if (!body && !file) throw new ApiError(400, "Enter a message or attach a file.");

    const attachments = [];
    if (file) {
      try {
        attachments.push(await saveTicketFile(String(ticket.workspaceId), id, file));
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Attachment failed");
      }
    }

    ticket.messages.push({
      authorType: "PLATFORM",
      authorId: session.sub,
      authorName: session.name,
      body: body || "Attachment added.",
      visibility,
      attachments,
    });
    ticket.events.push({
      action: visibility === "INTERNAL" ? "Internal Note" : "Reply Added",
      actorName: session.name,
      actorType: "PLATFORM",
      detail: body.slice(0, 80),
    });
    if (visibility === "PUBLIC") {
      ticket.unreadForSchool = true;
      if (ticket.status === "OPEN" || ticket.status === "ASSIGNED") ticket.status = "IN_PROGRESS";
      await notifySchoolUser(
        String(ticket.workspaceId),
        ticket.createdByUserId,
        `New reply on ${ticket.ticketNumber}`,
        body.slice(0, 140) || ticket.subject,
      );
    }
    await ticket.save();
    await logPlatform(session, "ticket.reply", { ticketNumber: ticket.ticketNumber, visibility });
    return json({ item: ticket });
  } catch (error) {
    return errorResponse(error);
  }
}
