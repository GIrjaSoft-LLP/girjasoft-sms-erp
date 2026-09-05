import { ApiError, errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { validateMarksWorkbook } from "@/lib/marks/bulk";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const form = await request.formData();
    const examId = String(form.get("examId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose an Excel file to upload.");
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw new ApiError(400, "Upload an Excel file in .xlsx format.");
    }
    if (file.size > 12 * 1024 * 1024) throw new ApiError(400, "The Excel file is too large (12 MB limit).");
    const preview = await validateMarksWorkbook(ctx, examId, Buffer.from(await file.arrayBuffer()));
    return json(preview);
  } catch (error) {
    return errorResponse(error);
  }
}
