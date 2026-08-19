import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext, requirePerm } from "@/lib/api/guards";
import { listPromotionCandidates } from "@/lib/promotion/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.promote");
    const url = new URL(request.url);
    const data = await listPromotionCandidates(ctx, {
      academicSessionId: url.searchParams.get("academicSessionId") ?? undefined,
      classId: url.searchParams.get("classId") ?? undefined,
      sectionId: url.searchParams.get("sectionId") ?? undefined,
      targetSessionId: url.searchParams.get("targetSessionId") ?? undefined,
    });
    return json({ items: data });
  } catch (error) {
    return errorResponse(error);
  }
}
