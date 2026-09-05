import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listLeaveTypes, saveLeaveType } from "@/lib/hr/leave";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.view");
    return json(await listLeaveTypes(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.create");
    return json(await saveLeaveType(ctx, await request.json()), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
