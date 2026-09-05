import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getExamForEdit } from "@/lib/exams/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "exams.view");
    const item = await getExamForEdit(ctx, id);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
