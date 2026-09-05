import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listResultCards } from "@/lib/results/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "results.view");
    return json(await listResultCards(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}
