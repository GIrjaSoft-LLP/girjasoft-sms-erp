import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { assertSchoolHelp } from "@/lib/ticket-access";
import { schoolTicketVisibilityQuery } from "@/lib/ticket-routing";
import { SupportTicket } from "@/models/support";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    assertSchoolHelp(ctx);
    const count = await SupportTicket.countDocuments({
      ...schoolTicketVisibilityQuery(ctx.workspaceId, ctx.session.sub, ctx.session.roleSlugs),
      unreadForSchool: true,
    });
    return json({ count });
  } catch (error) {
    return errorResponse(error);
  }
}
