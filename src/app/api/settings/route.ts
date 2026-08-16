import { z } from "zod";
import {
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.view");
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    return json({ settings, workspace });
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
        organization: z.record(z.string(), z.unknown()).optional(),
        academic: z.record(z.string(), z.unknown()).optional(),
        finance: z.record(z.string(), z.unknown()).optional(),
        attendance: z.record(z.string(), z.unknown()).optional(),
        examination: z.record(z.string(), z.unknown()).optional(),
        communication: z.record(z.string(), z.unknown()).optional(),
        workspace: z
          .object({
            schoolName: z.string().optional(),
            logo: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
        email: z.string().optional(),
            website: z.string().optional(),
          })
          .optional(),
      })
      .parse(await request.json());

    const { workspace, ...rest } = body;
    const settings = await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: rest },
      { new: true, upsert: true },
    );
    if (workspace) {
      await Workspace.findByIdAndUpdate(ctx.workspaceId, workspace);
    }
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}
