import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listLeaveRequests } from "@/lib/hr/leave";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.view");
    return json(await listLeaveRequests(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}
