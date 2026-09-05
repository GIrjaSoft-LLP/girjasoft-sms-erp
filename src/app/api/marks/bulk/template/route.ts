import { errorResponse, requireWorkspaceContext } from "@/lib/api/guards";
import { excelFileResponse } from "@/lib/excel";
import { buildMarksTemplateBuffer } from "@/lib/marks/bulk";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const url = new URL(request.url);
    const { buffer, filename } = await buildMarksTemplateBuffer(
      ctx,
      url.searchParams.get("examId") ?? "",
      url.searchParams.get("classId") || undefined,
      url.searchParams.get("sectionId") || undefined,
    );
    return excelFileResponse(buffer, filename);
  } catch (error) {
    return errorResponse(error);
  }
}
