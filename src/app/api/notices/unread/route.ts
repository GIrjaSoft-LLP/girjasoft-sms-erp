import { errorResponse, json, requirePerm, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { applyNoticeAudienceToQuery } from "@/lib/notices/access";
import { Notice, Notification } from "@/models/workspace";
import mongoose from "mongoose";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "notices.view");
    const workspaceId = new mongoose.Types.ObjectId(ctx.workspaceId);
    const userId = mongoose.isValidObjectId(ctx.session.sub)
      ? new mongoose.Types.ObjectId(ctx.session.sub)
      : ctx.session.sub;
    const unread = await Notification.countDocuments({
      workspaceId,
      read: false,
      $or: [{ userId }, { userId: null }],
    });
    const noticeQuery = scopedQuery(ctx.workspaceId);
    applyNoticeAudienceToQuery(ctx, "notices", noticeQuery);
    const notices = await Notice.countDocuments(noticeQuery);
    return json({ count: unread > 0 ? unread : notices });
  } catch (error) {
    return errorResponse(error);
  }
}
