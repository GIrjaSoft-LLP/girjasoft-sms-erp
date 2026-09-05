import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getResultReportById } from "@/lib/results/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "results.view");
    const { id } = await params;
    return json({ item: await getResultReportById(ctx, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
