import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listMarkSummaries } from "@/lib/marks/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    const url = new URL(request.url);
    const items = await listMarkSummaries(ctx, {
      examId: url.searchParams.get("examId") ?? undefined,
      classId: url.searchParams.get("classId") ?? undefined,
      sectionId: url.searchParams.get("sectionId") ?? undefined,
      studentId: url.searchParams.get("studentId") ?? undefined,
      subjectId: url.searchParams.get("subjectId") ?? undefined,
    });
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
