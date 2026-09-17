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
        admission: z.record(z.string(), z.unknown()).optional(),
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
    const $set: Record<string, unknown> = {};
    for (const [section, value] of Object.entries(rest)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
          $set[`${section}.${key}`] = nested;
        }
      } else if (value !== undefined) {
        $set[section] = value;
      }
    }
    const settings = await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      Object.keys($set).length ? { $set } : {},
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
