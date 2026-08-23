import type { EmailClientConfig } from "@/lib/email/types";
import type { EmailClientPatch } from "@/lib/email/schema";
import { encryptSecret } from "@/lib/email/crypto";
import { normalizeEmailClient } from "@/lib/email/config";
import { PASSWORD_MASK } from "@/lib/email/types";

export function mergeEmailClientPatch(current: EmailClientConfig, body: EmailClientPatch): EmailClientConfig {
  const next = normalizeEmailClient({
    ...current,
    ...body,
    smtpHost: body.smtpHost ?? current.smtpHost,
    smtpPort: body.smtpPort ?? current.smtpPort,
    encryption: body.encryption ?? current.encryption,
    smtpUsername: body.smtpUsername ?? current.smtpUsername,
    fromEmail: body.fromEmail ?? current.fromEmail,
    fromName: body.fromName ?? current.fromName,
    replyToEmail: body.replyToEmail ?? current.replyToEmail,
    incomingServer: body.incomingServer ?? current.incomingServer,
    imapPort: body.imapPort ?? current.imapPort,
    pop3Port: body.pop3Port ?? current.pop3Port,
    enabled: body.enabled ?? current.enabled,
    authEnabled: body.authEnabled ?? current.authEnabled,
  });

  if (body.smtpPassword && body.smtpPassword !== PASSWORD_MASK) {
    next.smtpPasswordEncrypted = encryptSecret(body.smtpPassword);
  }

  if (next.enabled) {
    if (!next.smtpHost || !next.fromEmail || !next.fromName) {
      throw new Error("Outgoing server, from email and from name are required when email client is enabled.");
    }
    if (next.authEnabled && (!next.smtpUsername || !next.smtpPasswordEncrypted)) {
      throw new Error("Username and password are required when authentication is enabled.");
    }
  }

  next.lastTestSuccess = false;
  return next;
}
