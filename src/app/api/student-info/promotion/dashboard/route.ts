import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext, requirePerm } from "@/lib/api/guards";
import { getPromotionDashboard } from "@/lib/promotion/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.promote");
    const data = await getPromotionDashboard(ctx);
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
