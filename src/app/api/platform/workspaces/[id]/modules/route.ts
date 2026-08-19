import { z } from "zod";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { ERP_MODULE_MAP } from "@/config/erp-modules";
import {
  ensureWorkspaceModuleConfiguration,
  resolveEnabledModules,
  sanitizeEnabledModules,
  serializeModulesForAdmin,
  validateModuleDisable,
} from "@/lib/workspace-modules";
import { Workspace } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePlatformPerm("platform.workspaces.view");
    const { id } = await ctx.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    const enabledModuleIds = await ensureWorkspaceModuleConfiguration(workspace);
    return json({
      workspace: { id: String(workspace._id), schoolName: workspace.schoolName, code: workspace.code },
      enabledModuleIds,
      modules: serializeModulesForAdmin(enabledModuleIds),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.edit");
    const { id } = await ctx.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    const body = z
      .object({
        enabledModules: z.array(z.string()),
      })
      .parse(await request.json());
    const previous = resolveEnabledModules(workspace);
    const next = sanitizeEnabledModules(body.enabledModules);
    for (const moduleId of previous) {
      if (next.includes(moduleId)) continue;
      const check = validateModuleDisable(moduleId, next);
      if (!check.ok) throw new ApiError(400, check.message ?? "Cannot disable module.");
    }
    workspace.enabledModules = next;
    workspace.moduleConfigVersion = 2;
    await workspace.save();
    const enabled = next.filter((moduleId) => !previous.includes(moduleId));
    const disabled = previous.filter((moduleId) => !next.includes(moduleId));
    await logPlatform(
      session,
      "WORKSPACE_MODULES_UPDATED",
      {
        code: workspace.code,
        enabled: enabled.map((moduleId) => ERP_MODULE_MAP[moduleId]?.name ?? moduleId),
        disabled: disabled.map((moduleId) => ERP_MODULE_MAP[moduleId]?.name ?? moduleId),
      },
      id,
    );
    return json({ enabledModuleIds: next, modules: serializeModulesForAdmin(next) });
  } catch (error) {
    return errorResponse(error);
  }
}
