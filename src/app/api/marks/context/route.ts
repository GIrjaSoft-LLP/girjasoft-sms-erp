import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getMarksFilterOptions, getMarksModuleContext } from "@/lib/marks/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    const [moduleContext, filterOptions] = await Promise.all([
      getMarksModuleContext(ctx),
      getMarksFilterOptions(ctx),
    ]);
    return json({ moduleContext, filterOptions });
  } catch (error) {
    return errorResponse(error);
  }
}
