import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getResultsModuleContext } from "@/lib/results/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "results.view");
    return json({ moduleContext: await getResultsModuleContext(ctx) });
  } catch (error) {
    return errorResponse(error);
  }
}
