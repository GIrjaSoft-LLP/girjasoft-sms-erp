import { z } from "zod";
import {
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { brandFromWorkspace, DEFAULT_LETTERHEAD_THEME, normalizeLetterheadTheme } from "@/config/theme";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.view");
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const organization = (settings?.organization ?? {}) as Record<string, unknown>;
    return json({
      theme: normalizeLetterheadTheme(settings?.theme ?? DEFAULT_LETTERHEAD_THEME),
      brand: brandFromWorkspace(workspace as Record<string, unknown> | null, organization),
      canEdit:
        ctx.impersonating ||
        ctx.session.permissions.includes("settings.edit") ||
        Boolean(ctx.session.roleSlugs?.includes("workspace_admin")),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.edit");
    const body = z
      .object({
        design: z.string(),
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
      })
      .parse(await request.json());
    const theme = normalizeLetterheadTheme(body);
    await Settings.findOneAndUpdate(scopedQuery(ctx.workspaceId), { $set: { theme } }, { upsert: true });
    return json({ theme });
  } catch (error) {
    return errorResponse(error);
  }
}
