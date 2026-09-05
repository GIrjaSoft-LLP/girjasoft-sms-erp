import mongoose from "mongoose";
import { ApiError, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { assertNoticeReadable, toPublicNotice } from "@/lib/notices/access";
import { Notice } from "@/models/workspace";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "notices.view");

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(404, "Notice not found.");
    }

    const item = await Notice.findOne({
      _id: id,
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    }).lean();

    if (!item) {
      throw new ApiError(404, "Notice not found.");
    }

    assertNoticeReadable(ctx, item);
    return json({ item: toPublicNotice(item as Record<string, unknown>) });
  } catch (error) {
    return errorResponse(error);
  }
}
