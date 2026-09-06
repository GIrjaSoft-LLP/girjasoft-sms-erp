import { cookies } from "next/headers";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { cookieOptions, VIEW_WORKSPACE_COOKIE } from "@/lib/session";
import { Workspace } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.manage");
    const { id } = await ctx.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    if (workspace.status === "ARCHIVED") {
      throw new ApiError(403, "Archived workspaces cannot be opened.");
    }
    const store = await cookies();
    store.set(VIEW_WORKSPACE_COOKIE, String(workspace._id), {
      ...cookieOptions,
      maxAge: 60 * 60 * 8,
    });
    await logPlatform(session, "WORKSPACE_ACCESSED", { name: workspace.name }, String(workspace._id));
    return json({ ok: true, redirectTo: "/dashboard", workspace: { name: workspace.schoolName } });
  } catch (error) {
    return errorResponse(error);
  }
}
