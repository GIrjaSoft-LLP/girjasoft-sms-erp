import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getClassSubjectEntry, getStudentMarksEntry } from "@/lib/marks/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "marks.view");
    const url = new URL(request.url);
    const examId = url.searchParams.get("examId") ?? "";
    const classId = url.searchParams.get("classId") ?? "";
    const sectionId = url.searchParams.get("sectionId") ?? "";
    const studentId = url.searchParams.get("studentId") ?? "";
    const subjectId = url.searchParams.get("subjectId") ?? "";

    if (subjectId && !studentId) {
      const item = await getClassSubjectEntry(ctx, examId, classId, sectionId, subjectId);
      return json({ mode: "class-subject", item });
    }
    const item = await getStudentMarksEntry(ctx, examId, classId, sectionId, studentId);
    return json({ mode: "student", item });
  } catch (error) {
    return errorResponse(error);
  }
}
