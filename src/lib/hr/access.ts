import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { Payroll, Teacher } from "@/models/workspace";

export function isTeacherSelfService(ctx: TenantContext) {
  return isTeacherLike(ctx.session.roleSlugs) && !isWorkspaceAdmin(ctx) && !ctx.impersonating;
}

export function assertTeacherHrConfigAllowed(ctx: TenantContext) {
  if (isTeacherSelfService(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}

export async function applyTeacherPayrollVisibility(ctx: TenantContext, query: Record<string, unknown>) {
  if (!isTeacherSelfService(ctx)) return;
  if (!ctx.session.linkedTeacherId) {
    throw new ApiError(403, "Teacher account is not linked.");
  }
  const teacher = await Teacher.findOne({
    _id: ctx.session.linkedTeacherId,
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
  })
    .select("employeeId")
    .lean();
  const clauses: Record<string, unknown>[] = [
    { teacherId: new mongoose.Types.ObjectId(ctx.session.linkedTeacherId) },
  ];
  if (teacher?.employeeId) clauses.push({ employeeId: teacher.employeeId });
  query.status = "PAID";
  query.$or = clauses;
}

export async function assertTeacherCanViewPayroll(ctx: TenantContext, payrollId: string) {
  if (!isTeacherSelfService(ctx)) return;
  await applyTeacherPayrollVisibility(ctx, {});
  const query: Record<string, unknown> = {
    _id: payrollId,
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
  };
  await applyTeacherPayrollVisibility(ctx, query);
  const item = await Payroll.findOne(query).lean();
  if (!item) throw new ApiError(403, "This salary slip is not available yet.");
}
