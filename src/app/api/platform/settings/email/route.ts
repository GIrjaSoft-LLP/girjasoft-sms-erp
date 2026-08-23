import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import {
  emailClientStatus,
  readEmailClientFromPlatformSettings,
  toPublicEmailClient,
} from "@/lib/email/config";
import { mergeEmailClientPatch } from "@/lib/email/merge-patch";
import { emailClientPatchSchema } from "@/lib/email/schema";
import { PlatformSettings } from "@/models/platform";

const KEY = "emailClient";

export async function GET() {
  try {
    await requirePlatformPerm("platform.settings.view");
    const doc = await PlatformSettings.findOne({ key: KEY }).lean();
    const publicConfig = toPublicEmailClient(readEmailClientFromPlatformSettings(doc));
    return json({ emailClient: publicConfig, status: emailClientStatus(publicConfig) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requirePlatformPerm("platform.settings.edit");
    const body = emailClientPatchSchema.parse(await request.json());
    const doc = await PlatformSettings.findOne({ key: KEY });
    const current = readEmailClientFromPlatformSettings(doc);
    let next;
    try {
      next = mergeEmailClientPatch(current, body);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Invalid configuration." }, 400);
    }

    await PlatformSettings.findOneAndUpdate(
      { key: KEY },
      { key: KEY, value: next },
      { upsert: true, new: true },
    );

    const publicConfig = toPublicEmailClient(next);
    await logPlatform(
      session,
      body.enabled === false ? "PLATFORM_EMAIL_CLIENT_DISABLED" : "PLATFORM_EMAIL_CLIENT_UPDATED",
      { enabled: publicConfig.enabled },
    );

    return json({
      emailClient: publicConfig,
      status: emailClientStatus(publicConfig),
      message: "Email client configuration saved successfully.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
