import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { applyTeacherLeave } from "@/lib/hr/leave";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.create");
    return json(await applyTeacherLeave(ctx, await request.json()), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
