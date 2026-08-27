import {
  readEmailClientFromPlatformSettings,
  readEmailClientFromSettings,
} from "@/lib/email/config";
import type { EmailClientConfig } from "@/lib/email/types";
import { PlatformSettings } from "@/models/platform";
import { Settings } from "@/models/workspace";

export const PLATFORM_EMAIL_KEY = "emailClient";

export type EmailConfigSource = "workspace" | "platform" | "none";

export type ResolvedEmailClient = {
  config: EmailClientConfig | null;
  source: EmailConfigSource;
};

export function isEmailClientReady(config: EmailClientConfig) {
  if (!config.enabled) return false;
  if (!config.smtpHost || !config.smtpPort || !config.fromEmail || !config.fromName) return false;
  if (config.authEnabled && (!config.smtpUsername || !config.smtpPasswordEncrypted)) return false;
  return true;
}

export async function loadPlatformEmailClientDoc() {
  return PlatformSettings.findOne({ key: PLATFORM_EMAIL_KEY }).lean();
}

export async function loadPlatformEmailClient() {
  const doc = await loadPlatformEmailClientDoc();
  return readEmailClientFromPlatformSettings(doc);
}

export async function loadWorkspaceEmailClient(workspaceId: string) {
  const settings = await Settings.findOne({ workspaceId }).lean();
  return readEmailClientFromSettings(settings);
}

export async function resolveEffectiveEmailClient(workspaceId: string): Promise<ResolvedEmailClient> {
  const workspaceConfig = await loadWorkspaceEmailClient(workspaceId);
  if (isEmailClientReady(workspaceConfig)) {
    return { config: workspaceConfig, source: "workspace" };
  }

  const platformConfig = await loadPlatformEmailClient();
  if (isEmailClientReady(platformConfig)) {
    return { config: platformConfig, source: "platform" };
  }

  return { config: null, source: "none" };
}

export async function markEmailClientTestSuccess(workspaceId: string, source: EmailConfigSource) {
  const testedAt = new Date().toISOString();
  if (source === "workspace") {
    const settings = await Settings.findOne({ workspaceId });
    const communication =
      settings?.communication && typeof settings.communication === "object"
        ? { ...(settings.communication as Record<string, unknown>) }
        : {};
    const emailClient = readEmailClientFromSettings(settings);
    emailClient.testedAt = testedAt;
    emailClient.lastTestSuccess = true;
    communication.emailClient = emailClient;
    await Settings.findOneAndUpdate({ workspaceId }, { $set: { communication } }, { upsert: true });
    return;
  }

  if (source === "platform") {
    const doc = await PlatformSettings.findOne({ key: PLATFORM_EMAIL_KEY });
    const emailClient = readEmailClientFromPlatformSettings(doc);
    emailClient.testedAt = testedAt;
    emailClient.lastTestSuccess = true;
    await PlatformSettings.findOneAndUpdate(
      { key: PLATFORM_EMAIL_KEY },
      { key: PLATFORM_EMAIL_KEY, value: emailClient },
      { upsert: true },
    );
  }
}

export function getAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
