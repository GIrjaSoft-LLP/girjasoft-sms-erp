import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getSalarySlip } from "@/lib/hr/payroll";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "payroll.view");
    const { id } = await params;
    return json(await getSalarySlip(ctx, id));
  } catch (error) {
    return errorResponse(error);
  }
}
