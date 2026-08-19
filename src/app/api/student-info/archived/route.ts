import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext, requirePerm } from "@/lib/api/guards";
import { listArchivedStudents } from "@/lib/promotion/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");
    const rows = await listArchivedStudents(ctx);
    return json({ items: rows });
  } catch (error) {
    return errorResponse(error);
  }
}
