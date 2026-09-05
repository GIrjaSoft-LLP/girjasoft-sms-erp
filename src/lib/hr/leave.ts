import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPermission } from "@/lib/rbac";
import { assertTeacherHrConfigAllowed, isTeacherSelfService } from "@/lib/hr/access";
import { LeaveRequest, LeaveType, PublicHoliday, Teacher } from "@/models/workspace";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export function countWorkingDays(fromDate: string, toDate: string, holidayDates: Set<string>) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new ApiError(400, "Enter a valid from and to date.");
  }
  let days = 0;
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const key = current.toISOString().slice(0, 10);
    if (!holidayDates.has(key)) days += 1;
  }
  return days;
}

const DEFAULT_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", days: 12 },
  { name: "Sick Leave", code: "SL", days: 10 },
];

export async function ensureDefaultLeaveTypes(workspaceId: string) {
  const count = await LeaveType.countDocuments({ workspaceId: oid(workspaceId) });
  if (count > 0) return;
  await LeaveType.insertMany(
    DEFAULT_LEAVE_TYPES.map((row) => ({ ...row, workspaceId: oid(workspaceId) })),
  );
}

export function getLeavePortalContext(ctx: TenantContext) {
  const teacher = isTeacherSelfService(ctx);
  return {
    mode: teacher ? "teacher" : "admin",
    canApply: Boolean(teacher && (hasPermission(ctx.permissions, "leave.create") || ctx.impersonating)),
    canManageConfig: Boolean(!teacher && (hasPermission(ctx.permissions, "leave.create") || hasPermission(ctx.permissions, "leave.edit") || ctx.impersonating)),
    canReview: Boolean(!teacher && (hasPermission(ctx.permissions, "leave.edit") || ctx.impersonating)),
    canDeleteConfig: Boolean(!teacher && (hasPermission(ctx.permissions, "leave.delete") || ctx.impersonating)),
  };
}

export async function listLeaveTypes(ctx: TenantContext) {
  await ensureDefaultLeaveTypes(ctx.workspaceId);
  const items = await LeaveType.find({ workspaceId: oid(ctx.workspaceId) }).sort({ name: 1 }).lean();
  return {
    items: items.map((row) => ({
      _id: String(row._id),
      name: row.name,
      code: row.code ?? "",
      days: Number(row.days ?? 0),
    })),
  };
}

export async function saveLeaveType(
  ctx: TenantContext,
  raw: unknown,
  id?: string,
) {
  assertTeacherHrConfigAllowed(ctx);
  if (!hasPermission(ctx.permissions, "leave.create") && !hasPermission(ctx.permissions, "leave.edit") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const input = z
    .object({
      name: z.string().trim().min(1),
      code: z.string().trim().optional().default(""),
      days: z.coerce.number().min(0),
    })
    .parse(raw);
  if (id) {
    const updated = await LeaveType.findOneAndUpdate(
      { _id: id, workspaceId: oid(ctx.workspaceId) },
      { $set: input },
      { returnDocument: "after" },
    );
    if (!updated) throw new ApiError(404, "Leave type not found.");
    return { item: updated };
  }
  const created = await LeaveType.create({ ...input, workspaceId: oid(ctx.workspaceId) });
  return { item: created };
}

export async function deleteLeaveType(ctx: TenantContext, id: string) {
  assertTeacherHrConfigAllowed(ctx);
  if (!hasPermission(ctx.permissions, "leave.delete") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  await LeaveType.deleteOne({ _id: id, workspaceId: oid(ctx.workspaceId) });
  return { deleted: true };
}

export async function listPublicHolidays(ctx: TenantContext) {
  const items = await PublicHoliday.find({ workspaceId: oid(ctx.workspaceId) }).sort({ date: 1 }).lean();
  return {
    items: items.map((row) => ({
      _id: String(row._id),
      name: row.name,
      date: row.date,
    })),
  };
}

export async function savePublicHoliday(ctx: TenantContext, raw: unknown, id?: string) {
  assertTeacherHrConfigAllowed(ctx);
  if (!hasPermission(ctx.permissions, "leave.create") && !hasPermission(ctx.permissions, "leave.edit") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const input = z.object({ name: z.string().trim().min(1), date: z.string().trim().min(1) }).parse(raw);
  if (id) {
    const updated = await PublicHoliday.findOneAndUpdate(
      { _id: id, workspaceId: oid(ctx.workspaceId) },
      { $set: input },
      { returnDocument: "after" },
    );
    if (!updated) throw new ApiError(404, "Holiday not found.");
    return { item: updated };
  }
  const created = await PublicHoliday.create({ ...input, workspaceId: oid(ctx.workspaceId) });
  return { item: created };
}

export async function deletePublicHoliday(ctx: TenantContext, id: string) {
  assertTeacherHrConfigAllowed(ctx);
  if (!hasPermission(ctx.permissions, "leave.delete") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  await PublicHoliday.deleteOne({ _id: id, workspaceId: oid(ctx.workspaceId) });
  return { deleted: true };
}

async function holidaySet(workspaceId: string) {
  const holidays = await PublicHoliday.find({ workspaceId: oid(workspaceId) }).select("date").lean();
  return new Set(holidays.map((row) => String(row.date).slice(0, 10)));
}

export async function getTeacherLeaveBalances(ctx: TenantContext, teacherId: string) {
  const year = String(new Date().getFullYear());
  const [types, requests, holidays] = await Promise.all([
    LeaveType.find({ workspaceId: oid(ctx.workspaceId) }).sort({ name: 1 }).lean(),
    LeaveRequest.find({
      workspaceId: oid(ctx.workspaceId),
      teacherId: oid(teacherId),
      status: { $in: ["PENDING", "APPROVED"] },
      fromDate: { $regex: `^${year}` },
    }).lean(),
    holidaySet(ctx.workspaceId),
  ]);
  return types.map((type) => {
    const used = requests
      .filter((row) => String(row.leaveTypeId) === String(type._id))
      .reduce((sum, row) => sum + countWorkingDays(row.fromDate, row.toDate, holidays), 0);
    const entitled = Number(type.days ?? 0);
    return {
      leaveTypeId: String(type._id),
      name: type.name,
      code: type.code ?? "",
      entitled,
      used,
      remaining: Math.max(0, entitled - used),
    };
  });
}

export async function applyTeacherLeave(ctx: TenantContext, raw: unknown) {
  if (!ctx.session.linkedTeacherId) throw new ApiError(403, "Teacher account is not linked.");
  if (!hasPermission(ctx.permissions, "leave.create") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const input = z
    .object({
      leaveTypeId: z.string().min(1),
      fromDate: z.string().min(1),
      toDate: z.string().min(1),
      reason: z.string().trim().optional().default(""),
    })
    .parse(raw);
  const teacher = await Teacher.findOne({
    _id: ctx.session.linkedTeacherId,
    workspaceId: oid(ctx.workspaceId),
  })
    .select("name")
    .lean();
  if (!teacher) throw new ApiError(404, "Teacher profile not found.");
  const type = await LeaveType.findOne({ _id: input.leaveTypeId, workspaceId: oid(ctx.workspaceId) }).lean();
  if (!type) throw new ApiError(400, "Select a valid leave type.");
  const holidays = await holidaySet(ctx.workspaceId);
  const days = countWorkingDays(input.fromDate, input.toDate, holidays);
  if (days <= 0) throw new ApiError(400, "The selected dates fall on public holidays.");
  const balances = await getTeacherLeaveBalances(ctx, ctx.session.linkedTeacherId);
  const balance = balances.find((row) => row.leaveTypeId === input.leaveTypeId);
  if (balance && days > balance.remaining) {
    throw new ApiError(400, `Only ${balance.remaining} ${type.name} day(s) remaining this year.`);
  }
  const created = await LeaveRequest.create({
    workspaceId: oid(ctx.workspaceId),
    teacherId: oid(ctx.session.linkedTeacherId),
    requesterName: teacher.name,
    leaveTypeId: oid(input.leaveTypeId),
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason: input.reason,
    status: "PENDING",
  });
  return { item: created };
}

export async function listLeaveRequests(ctx: TenantContext) {
  const query: Record<string, unknown> = { workspaceId: oid(ctx.workspaceId) };
  if (isTeacherSelfService(ctx)) {
    if (!ctx.session.linkedTeacherId) throw new ApiError(403, "Teacher account is not linked.");
    query.teacherId = oid(ctx.session.linkedTeacherId);
  }
  const items = await LeaveRequest.find(query).sort({ createdAt: -1 }).lean();
  const typeIds = [...new Set(items.map((row) => String(row.leaveTypeId ?? "")).filter(Boolean))];
  const types = typeIds.length ? await LeaveType.find({ _id: { $in: typeIds } }).select("name code").lean() : [];
  const typeMap = new Map(types.map((row) => [String(row._id), row]));
  return {
    items: items.map((row) => ({
      _id: String(row._id),
      requesterName: row.requesterName,
      leaveTypeName: typeMap.get(String(row.leaveTypeId ?? ""))?.name ?? "",
      leaveTypeCode: typeMap.get(String(row.leaveTypeId ?? ""))?.code ?? "",
      fromDate: row.fromDate,
      toDate: row.toDate,
      reason: row.reason ?? "",
      status: row.status,
    })),
  };
}

export async function reviewLeaveRequest(ctx: TenantContext, id: string, status: "APPROVED" | "REJECTED") {
  assertTeacherHrConfigAllowed(ctx);
  if (!hasPermission(ctx.permissions, "leave.edit") && !ctx.impersonating) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: id, workspaceId: oid(ctx.workspaceId) },
    { $set: { status } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ApiError(404, "Leave request not found.");
  return { item: updated };
}
