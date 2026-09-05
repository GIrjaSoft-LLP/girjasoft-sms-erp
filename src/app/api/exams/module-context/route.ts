import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getExamFilterOptions, getExamModuleContext } from "@/lib/exams/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "exams.view");
    const [moduleContext, filterOptions] = await Promise.all([
      getExamModuleContext(ctx),
      getExamFilterOptions(ctx),
    ]);
    return json({ moduleContext, filterOptions });
  } catch (error) {
    return errorResponse(error);
  }
}
