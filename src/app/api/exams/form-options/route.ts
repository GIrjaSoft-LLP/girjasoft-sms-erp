import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getExamFormOptions } from "@/lib/exams/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "exams.view");
    const options = await getExamFormOptions(ctx);
    return json(options);
  } catch (error) {
    return errorResponse(error);
  }
}
