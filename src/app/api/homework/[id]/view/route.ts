import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { getHomeworkForView } from "@/lib/homework/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "homework.view");
    const item = await getHomeworkForView(ctx, id);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
