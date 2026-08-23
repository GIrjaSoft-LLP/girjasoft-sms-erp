import nodemailer from "nodemailer";
import type { EmailClientConfig, EmailEncryption } from "@/lib/email/types";
import { decryptSecret } from "@/lib/email/crypto";

function transportOptions(config: EmailClientConfig) {
  const secure = config.encryption === "ssl" || config.encryption === "tls";
  const requireTLS = config.encryption === "starttls";
  const auth =
    config.authEnabled && config.smtpUsername
      ? {
          user: config.smtpUsername,
          pass: decryptSecret(config.smtpPasswordEncrypted),
        }
      : undefined;

  return {
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
    requireTLS,
    auth,
    tls: requireTLS ? { minVersion: "TLSv1.2" as const } : undefined,
  };
}

export async function sendWorkspaceEmail(
  config: EmailClientConfig,
  options: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
  },
) {
  const transporter = nodemailer.createTransport(transportOptions(config));
  await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo || config.replyToEmail || undefined,
  });
}

export function validateEmailClientForSend(config: EmailClientConfig) {
  if (!config.enabled) throw new Error("Email client is disabled.");
  if (!config.smtpHost) throw new Error("SMTP host is required.");
  if (!config.smtpPort) throw new Error("SMTP port is required.");
  if (!config.fromEmail) throw new Error("From email is required.");
  if (!config.fromName) throw new Error("From name is required.");
  if (config.authEnabled) {
    if (!config.smtpUsername) throw new Error("SMTP username is required.");
    if (!config.smtpPasswordEncrypted) throw new Error("SMTP password is required.");
  }
}

export function encryptionLabel(value: EmailEncryption) {
  return value.toUpperCase();
}
