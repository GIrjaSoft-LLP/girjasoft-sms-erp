import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getResultReport } from "@/lib/results/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "results.view");
    const url = new URL(request.url);
    const item = await getResultReport(
      ctx,
      url.searchParams.get("examId") ?? "",
      url.searchParams.get("studentId") ?? undefined,
    );
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
