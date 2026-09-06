import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { Workspace } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.manage");
    const { id } = await ctx.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    if (workspace.status === "ARCHIVED") {
      throw new ApiError(400, "Restore this workspace from Archived instead of activating it.");
    }
    workspace.status = "ACTIVE";
    await workspace.save();
    await logPlatform(session, "WORKSPACE_ACTIVATED", {}, id);
    return json({ item: workspace });
  } catch (error) {
    return errorResponse(error);
  }
}
