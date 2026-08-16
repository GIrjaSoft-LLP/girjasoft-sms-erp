import {
  ApiError,
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";
import { removeWorkspaceLogoFile, saveWorkspaceLogo } from "@/lib/workspace-logo";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.edit");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a logo image to upload.");
    let logo: string;
    try {
      logo = await saveWorkspaceLogo(ctx.workspaceId, file);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Upload failed");
    }
    await Workspace.findByIdAndUpdate(ctx.workspaceId, { logo });
    await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: { "organization.logo": logo } },
      { upsert: true },
    );
    return json({ logo });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.edit");
    await removeWorkspaceLogoFile(ctx.workspaceId);
    await Workspace.findByIdAndUpdate(ctx.workspaceId, { logo: "" });
    await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: { "organization.logo": "" } },
      { upsert: true },
    );
    return json({ logo: "" });
  } catch (error) {
    return errorResponse(error);
  }
}
