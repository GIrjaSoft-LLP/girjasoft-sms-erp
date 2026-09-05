import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { createClassStudentFees } from "@/lib/fees/service";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const result = await createClassStudentFees(ctx, await request.json());
    await logWorkspace(ctx.session, ctx.workspaceId, "FEES_CLASS_CREATED", "fees", "", result);
    return json({ message: `Fee created for ${result.created} student(s).`, ...result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
