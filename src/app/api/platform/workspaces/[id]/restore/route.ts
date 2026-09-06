import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { restoreWorkspace } from "@/lib/platform/workspace-archive";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.manage");
    const { id } = await ctx.params;
    const result = await restoreWorkspace(session, id);
    return json({ item: result.workspace, userCount: result.userCount });
  } catch (error) {
    return errorResponse(error);
  }
}
