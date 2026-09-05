import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { deleteLeaveType, saveLeaveType } from "@/lib/hr/leave";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.edit");
    const { id } = await params;
    return json(await saveLeaveType(ctx, await request.json(), id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.delete");
    const { id } = await params;
    return json(await deleteLeaveType(ctx, id));
  } catch (error) {
    return errorResponse(error);
  }
}
