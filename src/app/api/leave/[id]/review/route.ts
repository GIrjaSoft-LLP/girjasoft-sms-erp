import { ApiError, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { reviewLeaveRequest } from "@/lib/hr/leave";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.edit");
    const { id } = await params;
    const body = (await request.json()) as { status?: string };
    const status = body.status;
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new ApiError(400, "Status must be Approved or Rejected.");
    }
    return json(await reviewLeaveRequest(ctx, id, status));
  } catch (error) {
    return errorResponse(error);
  }
}
