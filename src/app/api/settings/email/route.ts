import { z } from "zod";
import {
  errorResponse,
  json,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import {
  emailClientStatus,
  readEmailClientFromSettings,
  toPublicEmailClient,
} from "@/lib/email/config";
import { mergeEmailClientPatch } from "@/lib/email/merge-patch";
import { emailClientPatchSchema } from "@/lib/email/schema";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin";
import { Settings } from "@/models/workspace";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requireWorkspaceAdmin(ctx);
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const config = readEmailClientFromSettings(settings);
    const publicConfig = toPublicEmailClient(config);
    return json({ emailClient: publicConfig, status: emailClientStatus(publicConfig) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requireWorkspaceAdmin(ctx);
    const body = emailClientPatchSchema.parse(await request.json());
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId));
    const current = readEmailClientFromSettings(settings);
    let next;
    try {
      next = mergeEmailClientPatch(current, body);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Invalid configuration." }, 400);
    }

    const communication =
      settings?.communication && typeof settings.communication === "object"
        ? { ...(settings.communication as Record<string, unknown>) }
        : {};
    communication.emailClient = next;

    const updated = await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: { communication } },
      { new: true, upsert: true },
    );

    const publicConfig = toPublicEmailClient(readEmailClientFromSettings(updated));
    await logWorkspace(ctx.session, ctx.workspaceId, body.enabled === false ? "EMAIL_CLIENT_DISABLED" : "EMAIL_CLIENT_UPDATED", "settings", ctx.workspaceId, {
      enabled: publicConfig.enabled,
    });

    return json({
      emailClient: publicConfig,
      status: emailClientStatus(publicConfig),
      message: "Email client configuration saved successfully.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
