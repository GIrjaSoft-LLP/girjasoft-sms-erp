import { z } from "zod";
import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { sendWorkspaceEmail, validateEmailClientForSend } from "@/lib/email/client";
import { readEmailClientFromPlatformSettings } from "@/lib/email/config";
import { buildTestEmail } from "@/lib/email/templates";
import { APP_NAME } from "@/config/branding";
import { PlatformSettings } from "@/models/platform";

const KEY = "emailClient";

const schema = z.object({
  to: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const session = await requirePlatformPerm("platform.settings.edit");
    const body = schema.parse(await request.json());
    const doc = await PlatformSettings.findOne({ key: KEY }).lean();
    const config = readEmailClientFromPlatformSettings(doc);
    validateEmailClientForSend(config);

    const mail = buildTestEmail({ schoolName: APP_NAME });

    try {
      await sendWorkspaceEmail(config, {
        to: body.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      console.error("[platform-email-test]", err instanceof Error ? err.message : "send failed");
      return json(
        {
          error:
            "Unable to send test email. Please verify SMTP host, port, encryption, username and password.",
        },
        502,
      );
    }

    const emailClient = readEmailClientFromPlatformSettings(doc);
    emailClient.testedAt = new Date().toISOString();
    emailClient.lastTestSuccess = true;

    await PlatformSettings.findOneAndUpdate({ key: KEY }, { key: KEY, value: emailClient }, { upsert: true });
    await logPlatform(session, "PLATFORM_EMAIL_CLIENT_TESTED", { recipient: body.to });

    return json({ message: "Test email sent successfully." });
  } catch (error) {
    return errorResponse(error);
  }
}
