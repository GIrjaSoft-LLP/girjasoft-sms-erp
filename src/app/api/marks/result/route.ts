import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getExamResultView } from "@/lib/marks/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    const url = new URL(request.url);
    const item = await getExamResultView(
      ctx,
      url.searchParams.get("examId") ?? "",
      url.searchParams.get("studentId") ?? undefined,
    );
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
