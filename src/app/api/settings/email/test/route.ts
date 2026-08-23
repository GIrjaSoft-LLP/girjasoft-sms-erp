import { z } from "zod";
import { errorResponse, json, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { sendWorkspaceEmail, validateEmailClientForSend } from "@/lib/email/client";
import { readEmailClientFromSettings } from "@/lib/email/config";
import { buildTestEmail } from "@/lib/email/templates";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";

const schema = z.object({
  to: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requireWorkspaceAdmin(ctx);
    const body = schema.parse(await request.json());
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const config = readEmailClientFromSettings(settings);
    validateEmailClientForSend(config);

    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const schoolName = workspace?.schoolName || workspace?.name || "Your School";
    const mail = buildTestEmail({ schoolName });

    try {
      await sendWorkspaceEmail(config, {
        to: body.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      console.error("[email-test]", err instanceof Error ? err.message : "send failed");
      return json(
        {
          error:
            "Unable to send test email. Please verify SMTP host, port, encryption, username and password.",
        },
        502,
      );
    }

    const communication =
      settings?.communication && typeof settings.communication === "object"
        ? { ...(settings.communication as Record<string, unknown>) }
        : {};
    const emailClient = readEmailClientFromSettings(settings);
    emailClient.testedAt = new Date().toISOString();
    emailClient.lastTestSuccess = true;
    communication.emailClient = emailClient;

    await Settings.findOneAndUpdate(scopedQuery(ctx.workspaceId), { $set: { communication } }, { upsert: true });
    await logWorkspace(ctx.session, ctx.workspaceId, "EMAIL_CLIENT_TESTED", "settings", ctx.workspaceId, {
      recipient: body.to,
    });

    return json({ message: "Test email sent successfully." });
  } catch (error) {
    return errorResponse(error);
  }
}
