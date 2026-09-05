import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listTeacherSalarySlips } from "@/lib/hr/payroll";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "payroll.view");
    return json(await listTeacherSalarySlips(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}
