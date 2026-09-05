import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getLeavePortalContext } from "@/lib/hr/leave";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.view");
    return json(getLeavePortalContext(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}
