import { errorResponse, json, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { assertSchoolHelp } from "@/lib/ticket-access";
import { SupportTicket } from "@/models/support";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    assertSchoolHelp(ctx);
    const count = await SupportTicket.countDocuments({
      ...scopedQuery(ctx.workspaceId),
      unreadForSchool: true,
    });
    return json({ count });
  } catch (error) {
    return errorResponse(error);
  }
}
