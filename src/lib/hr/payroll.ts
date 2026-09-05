import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { applyTeacherPayrollVisibility, isTeacherSelfService } from "@/lib/hr/access";
import { Payroll, Teacher } from "@/models/workspace";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function listTeacherSalarySlips(ctx: TenantContext) {
  if (!ctx.session.linkedTeacherId) {
    if (isTeacherSelfService(ctx)) throw new ApiError(403, "Teacher account is not linked.");
    return { items: [] };
  }
  const teacher = await Teacher.findOne({
    _id: ctx.session.linkedTeacherId,
    workspaceId: oid(ctx.workspaceId),
  })
    .select("employeeId")
    .lean();
  const query: Record<string, unknown> = {
    workspaceId: oid(ctx.workspaceId),
    status: "PAID",
    $or: [
      { teacherId: oid(ctx.session.linkedTeacherId) },
      ...(teacher?.employeeId ? [{ employeeId: teacher.employeeId }] : []),
    ],
  };
  const items = await Payroll.find(query).sort({ month: -1 }).lean();
  return {
    items: items.map((row) => ({
      _id: String(row._id),
      staffName: row.staffName,
      employeeId: row.employeeId ?? "",
      month: row.month,
      basic: row.basic,
      allowances: row.allowances ?? 0,
      deductions: row.deductions ?? 0,
      netPay: row.netPay,
      status: row.status,
    })),
  };
}

export async function getSalarySlip(ctx: TenantContext, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid salary slip.");
  const query: Record<string, unknown> = { _id: id, workspaceId: oid(ctx.workspaceId) };
  if (isTeacherSelfService(ctx)) {
    await applyTeacherPayrollVisibility(ctx, query);
  }
  const item = await Payroll.findOne(query).lean();
  if (!item) throw new ApiError(404, "Salary slip not found.");
  if (isTeacherSelfService(ctx) && item.status !== "PAID") {
    throw new ApiError(403, "This salary slip is not available yet.");
  }
  return {
    item: {
      staffName: item.staffName,
      employeeId: item.employeeId ?? "",
      month: item.month,
      basic: item.basic,
      allowances: item.allowances ?? 0,
      deductions: item.deductions ?? 0,
      netPay: item.netPay,
      status: item.status,
    },
  };
}

export async function linkPayrollTeacher(workspaceId: string, body: Record<string, unknown>) {
  if (body.teacherId) return body;
  const employeeId = String(body.employeeId ?? "").trim();
  const staffName = String(body.staffName ?? "").trim();
  if (!employeeId && !staffName) return body;
  const teacher = employeeId
    ? await Teacher.findOne({ workspaceId, employeeId }).select("_id").lean()
    : await Teacher.findOne({ workspaceId, name: staffName }).select("_id").lean();
  if (teacher) body.teacherId = teacher._id;
  return body;
}
