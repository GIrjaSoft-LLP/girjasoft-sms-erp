import { z } from "zod";
import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { sendAppEmail } from "@/lib/email/client";
import { buildTestEmail } from "@/lib/email/templates";
import { markEmailClientTestSuccess } from "@/lib/email/resolve";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin";
import { Workspace } from "@/models/platform";

const schema = z.object({
  to: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requireWorkspaceAdmin(ctx);
    const body = schema.parse(await request.json());

    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const schoolName = workspace?.schoolName || workspace?.name || "Your School";
    const mail = buildTestEmail({ schoolName });

    try {
      const resolved = await sendAppEmail(ctx.workspaceId, {
        to: body.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      await markEmailClientTestSuccess(ctx.workspaceId, resolved.source);
      await logWorkspace(ctx.session, ctx.workspaceId, "EMAIL_CLIENT_TESTED", "settings", ctx.workspaceId, {
        recipient: body.to,
        source: resolved.source,
      });
      return json({ message: `Test email sent successfully to ${body.to}.` });
    } catch (err) {
      console.error("[email-test]", err instanceof Error ? err.message : "send failed");
      return json(
        {
          error: "Unable to send test email. Please verify SMTP configuration.",
        },
        502,
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
