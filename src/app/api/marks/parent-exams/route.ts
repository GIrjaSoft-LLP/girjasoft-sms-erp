import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listParentExams } from "@/lib/marks/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    const data = await listParentExams(ctx);
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
