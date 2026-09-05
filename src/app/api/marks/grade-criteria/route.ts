import { ApiError, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getGradeCriteriaForWorkspace, saveGradeCriteria } from "@/lib/marks/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    return json(await getGradeCriteriaForWorkspace(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.edit");
    const body = await request.json();
    const items = Array.isArray(body) ? body : body.items;
    try {
      return json({ message: "Rating criteria saved.", ...(await saveGradeCriteria(ctx, items)) });
    } catch (error) {
      if (error instanceof Error && !(error instanceof ApiError)) {
        throw new ApiError(400, error.message);
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
