import type { EmailClientConfig, EmailClientPublic, EmailEncryption } from "@/lib/email/types";
import { DEFAULT_EMAIL_CLIENT, PASSWORD_MASK } from "@/lib/email/types";

export function normalizeEmailClient(raw: unknown): EmailClientConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const encryption = String(row.encryption ?? DEFAULT_EMAIL_CLIENT.encryption).toLowerCase();
  const allowed: EmailEncryption[] = ["none", "ssl", "tls", "starttls"];
  return {
    enabled: Boolean(row.enabled),
    smtpHost: String(row.smtpHost ?? "").trim(),
    smtpPort: Number(row.smtpPort ?? DEFAULT_EMAIL_CLIENT.smtpPort) || 587,
    encryption: allowed.includes(encryption as EmailEncryption)
      ? (encryption as EmailEncryption)
      : DEFAULT_EMAIL_CLIENT.encryption,
    authEnabled: row.authEnabled !== false,
    smtpUsername: String(row.smtpUsername ?? "").trim(),
    smtpPasswordEncrypted: String(row.smtpPasswordEncrypted ?? ""),
    fromEmail: String(row.fromEmail ?? "").trim(),
    fromName: String(row.fromName ?? "").trim(),
    replyToEmail: String(row.replyToEmail ?? "").trim(),
    incomingServer: String(row.incomingServer ?? "").trim(),
    imapPort: Number(row.imapPort ?? DEFAULT_EMAIL_CLIENT.imapPort) || 993,
    pop3Port: Number(row.pop3Port ?? DEFAULT_EMAIL_CLIENT.pop3Port) || 995,
    testedAt: row.testedAt ? String(row.testedAt) : null,
    lastTestSuccess: Boolean(row.lastTestSuccess),
  };
}

export function toPublicEmailClient(config: EmailClientConfig): EmailClientPublic {
  const { smtpPasswordEncrypted, ...rest } = config;
  return {
    ...rest,
    hasPassword: Boolean(smtpPasswordEncrypted),
    passwordMasked: smtpPasswordEncrypted ? PASSWORD_MASK : "",
  };
}

export function readEmailClientFromSettings(settings: { communication?: unknown } | null | undefined) {
  const communication =
    settings?.communication && typeof settings.communication === "object"
      ? (settings.communication as Record<string, unknown>)
      : {};
  return normalizeEmailClient(communication.emailClient);
}

export function readEmailClientFromPlatformSettings(doc: { value?: unknown } | null | undefined) {
  return normalizeEmailClient(doc?.value);
}

export function emailClientStatus(config: EmailClientPublic) {
  if (!config.enabled) return { label: "Disabled", tone: "muted" as const };
  if (config.lastTestSuccess) return { label: "Enabled — configuration verified", tone: "success" as const };
  return { label: "Enabled — configuration not tested", tone: "warning" as const };
}
