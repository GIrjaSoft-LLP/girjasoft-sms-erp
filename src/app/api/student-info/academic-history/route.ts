import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext, requirePerm } from "@/lib/api/guards";
import { getAcademicHistory } from "@/lib/promotion/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");
    const url = new URL(request.url);
    const data = await getAcademicHistory(ctx, {
      studentId: url.searchParams.get("studentId") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    });
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
