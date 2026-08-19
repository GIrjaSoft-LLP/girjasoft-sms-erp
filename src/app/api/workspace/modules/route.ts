import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { ERP_MODULES } from "@/config/erp-modules";
import { modulesForWorkspace } from "@/lib/workspace-modules";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "profile.view");
    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const visible = modulesForWorkspace(workspace, ctx.permissions, ctx.allowAllModules);
    return json({
      enabledModuleIds: ctx.enabledModules,
      modules: visible.map((module) => ({
        id: module.id,
        name: module.name,
        description: module.description,
        icon: module.icon,
        route: module.route,
        category: module.category,
        accent: module.accent,
      })),
      catalog: ERP_MODULES.filter((module) => module.status === "available").map((module) => ({
        id: module.id,
        name: module.name,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
