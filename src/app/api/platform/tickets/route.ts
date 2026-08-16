import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { errorResponse, json, requireSuperAdmin } from "@/lib/api/guards";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES, supportModules } from "@/config/tickets";
import { SupportTicket } from "@/models/support";
import { Workspace } from "@/models/platform";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? "";
    const type = url.searchParams.get("type") ?? "";
    const priority = url.searchParams.get("priority") ?? "";
    const moduleName = url.searchParams.get("module") ?? "";
    const workspaceId = url.searchParams.get("workspaceId") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(10, Number(url.searchParams.get("limit") ?? 20)));
    const sort = url.searchParams.get("sort") === "asc" ? 1 : -1;

    const query: Record<string, unknown> = {};
    if (status && TICKET_STATUSES.includes(status as (typeof TICKET_STATUSES)[number])) query.status = status;
    if (type && TICKET_TYPES.includes(type as (typeof TICKET_TYPES)[number])) query.type = type;
    if (priority && TICKET_PRIORITIES.includes(priority as (typeof TICKET_PRIORITIES)[number])) {
      query.priority = priority;
    }
    if (moduleName) query.module = moduleName;
    if (workspaceId && mongoose.isValidObjectId(workspaceId)) {
      query.workspaceId = new mongoose.Types.ObjectId(workspaceId);
    }
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.$gte = new Date(from);
      if (to) createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
      query.createdAt = createdAt;
    }
    if (q) {
      const re = { $regex: q, $options: "i" };
      query.$or = [{ ticketNumber: re }, { subject: re }, { schoolName: re }, { createdByName: re }];
    }

    const [items, total, grouped, critical, workspaces] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: sort })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      SupportTicket.countDocuments({ priority: "CRITICAL", status: { $nin: ["CLOSED"] } }),
      Workspace.find({}).select("schoolName code").sort({ schoolName: 1 }).lean(),
    ]);

    const byStatus = Object.fromEntries(grouped.map((row) => [row._id, row.count]));
    const stats = {
      total: await SupportTicket.countDocuments(),
      open: byStatus.OPEN ?? 0,
      assigned: byStatus.ASSIGNED ?? 0,
      inProgress: byStatus.IN_PROGRESS ?? 0,
      waiting: byStatus.WAITING_FOR_SCHOOL ?? 0,
      resolved: byStatus.RESOLVED ?? 0,
      closed: byStatus.CLOSED ?? 0,
      critical,
    };

    return json({
      items,
      total,
      page,
      limit,
      stats,
      modules: supportModules(),
      workspaces: workspaces.map((row) => ({
        id: String(row._id),
        schoolName: row.schoolName,
        code: row.code,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
