import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listExamScheduleRows } from "@/lib/exams/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "exams.view");
    const url = new URL(request.url);
    const items = await listExamScheduleRows(ctx, {
      academicSessionId: url.searchParams.get("academicSessionId") ?? undefined,
      examId: url.searchParams.get("examId") ?? undefined,
      classId: url.searchParams.get("classId") ?? undefined,
      sectionId: url.searchParams.get("sectionId") ?? undefined,
      subjectId: url.searchParams.get("subjectId") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
    });
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
