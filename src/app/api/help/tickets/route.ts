import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { TICKET_PRIORITIES, TICKET_TYPES, supportModules } from "@/config/tickets";
import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertSchoolHelp, canSetCritical, publicTicket } from "@/lib/ticket-access";
import { saveTicketFile } from "@/lib/ticket-files";
import { nextTicketNumber } from "@/lib/ticket-id";
import { isPlatformActor } from "@/lib/session";
import { notifyWorkspaceUsersByRoles } from "@/lib/ticket-notify";
import { routingRole, schoolTicketVisibilityQuery, ticketRouteForRoles, notifyRoleSlugsForTicket } from "@/lib/ticket-routing";
import { SupportTicket } from "@/models/support";
import { Workspace } from "@/models/platform";

function summary(ticket: Record<string, unknown>) {
  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    type: ticket.type,
    subject: ticket.subject,
    priority: ticket.priority,
    status: ticket.status,
    module: ticket.module,
    createdByName: ticket.createdByName,
    createdByRole: ticket.createdByRole,
    ticketRoute: ticket.ticketRoute,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    unreadForSchool: ticket.unreadForSchool,
  };
}

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    assertSchoolHelp(ctx);
    const items = await SupportTicket.find(
      schoolTicketVisibilityQuery(ctx.workspaceId, ctx.session.sub, ctx.session.roleSlugs),
    )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const counts = {
      open: items.filter((row) => row.status === "OPEN").length,
      inProgress: items.filter((row) => row.status === "IN_PROGRESS" || row.status === "ASSIGNED").length,
      resolved: items.filter((row) => row.status === "RESOLVED").length,
      closed: items.filter((row) => row.status === "CLOSED").length,
    };
    return json({ items: items.map((row) => summary(row as Record<string, unknown>)), counts, modules: supportModules() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceContext();
    assertSchoolHelp(ctx);
    const contentType = request.headers.get("content-type") ?? "";
    let type = "INCIDENT";
    let subject = "";
    let description = "";
    let priority = "MEDIUM";
    let moduleName = "Other";
    let page = "";
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      type = String(form.get("type") ?? "INCIDENT");
      subject = String(form.get("subject") ?? "").trim();
      description = String(form.get("description") ?? "").trim();
      priority = String(form.get("priority") ?? "MEDIUM");
      moduleName = String(form.get("module") ?? "Other");
      page = String(form.get("page") ?? "").trim();
      const uploaded = form.get("file");
      if (uploaded instanceof File && uploaded.size > 0) file = uploaded;
    } else {
      const body = (await request.json()) as Record<string, string>;
      type = body.type ?? "INCIDENT";
      subject = String(body.subject ?? "").trim();
      description = String(body.description ?? "").trim();
      priority = body.priority ?? "MEDIUM";
      moduleName = body.module ?? "Other";
      page = String(body.page ?? "").trim();
    }

    if (!TICKET_TYPES.includes(type as (typeof TICKET_TYPES)[number])) {
      throw new ApiError(400, "Choose Incident or Request.");
    }
    if (!subject || !description) throw new ApiError(400, "Subject and description are required.");
    if (!TICKET_PRIORITIES.includes(priority as (typeof TICKET_PRIORITIES)[number])) {
      throw new ApiError(400, "Invalid priority.");
    }
    if (priority === "CRITICAL" && !canSetCritical(ctx)) {
      throw new ApiError(400, "Critical priority can only be set by a workspace admin.");
    }
    const modules = supportModules();
    if (!modules.includes(moduleName)) moduleName = "Other";

    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const ticketNumber = await nextTicketNumber();
    const createdByRole = routingRole(ctx.session.roleSlugs, ctx.session.sessionRole ?? "");
    const ticketRoute =
      ctx.impersonating && isPlatformActor(ctx.session) ? "PLATFORM" : ticketRouteForRoles(ctx.session.roleSlugs);
    const created = await SupportTicket.create({
      ticketNumber,
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      schoolName: workspace?.schoolName ?? "",
      schoolCode: workspace?.code ?? "",
      createdByUserId: ctx.session.sub,
      createdByName: ctx.session.name,
      createdByEmail: ctx.session.email,
      createdByRole,
      ticketRoute,
      type,
      subject,
      description,
      priority,
      module: moduleName,
      page,
      status: "OPEN",
      unreadForPlatform: ticketRoute === "PLATFORM",
      unreadForSchool: ticketRoute === "WORKSPACE",
      messages: [
        {
          authorType: "SCHOOL",
          authorId: ctx.session.sub,
          authorName: ctx.session.name,
          body: description,
          visibility: "PUBLIC",
        },
      ],
      events: [
        {
          action: "Ticket Created",
          actorName: ctx.session.name,
          actorType: "SCHOOL",
          detail: `${type} · ${priority}`,
        },
      ],
    });

    if (file) {
      try {
        const saved = await saveTicketFile(ctx.workspaceId, String(created._id), file);
        created.attachments.push(saved);
        created.events.push({
          action: "Attachment Added",
          actorName: ctx.session.name,
          actorType: "SCHOOL",
          detail: saved.name,
        });
        await created.save();
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Attachment failed");
      }
    }

    await logWorkspace(ctx.session, ctx.workspaceId, "ticket.create", "tickets", String(created._id), {
      ticketNumber,
      ticketRoute,
    });
    if (ticketRoute === "WORKSPACE") {
      await notifyWorkspaceUsersByRoles(
        ctx.workspaceId,
        notifyRoleSlugsForTicket(created),
        `New support request ${ticketNumber}`,
        subject,
        ctx.session.sub,
      );
    }
    return json({ item: publicTicket(created.toObject() as Record<string, unknown>, true) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
