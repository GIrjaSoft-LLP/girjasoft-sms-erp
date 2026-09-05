import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { updateExamWithSchedules } from "@/lib/exams/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    const body = await request.json();
    const result = await updateExamWithSchedules(ctx, id, body);
    return json({ message: "Exam updated successfully.", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
