import { APP_NAME, COMPANY_NAME } from "@/config/branding";

export function buildPasswordResetEmail(options: {
  userName: string;
  schoolName: string;
  resetUrl: string;
  expiresMinutes: number;
}) {
  const subject = `Reset Your ${APP_NAME} Password`;
  const greeting = options.userName ? `Hello ${options.userName},` : "Hello,";
  const text = [
    greeting,
    "",
    `We received a request to reset your ${APP_NAME} password for ${options.schoolName}.`,
    "",
    `Reset your password: ${options.resetUrl}`,
    "",
    `This link is valid for ${options.expiresMinutes} minutes and can only be used once.`,
    "If you did not request this password reset, you can safely ignore this email.",
    "",
    `Regards,`,
    APP_NAME,
    `Powered by ${COMPANY_NAME}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#12203a;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;color:#0b1b3a;">${APP_NAME}</h2>
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 16px;">We received a request to reset your <strong>${APP_NAME}</strong> password for <strong>${options.schoolName}</strong>.</p>
      <p style="margin:0 0 20px;">
        <a href="${options.resetUrl}" style="display:inline-block;background:#4c7eff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Reset Password</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#64748b;">This link is valid for ${options.expiresMinutes} minutes and can only be used once.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#64748b;">If you did not request this password reset, you can safely ignore this email.</p>
      <p style="margin:24px 0 0;font-size:14px;">Regards,<br/>${APP_NAME}<br/><span style="color:#64748b;">Powered by ${COMPANY_NAME}</span></p>
    </div>
  `;

  return { subject, text, html };
}

export function buildTestEmail(options: { schoolName: string }) {
  const subject = `${APP_NAME} — Test Email Configuration`;
  const text = `This is a test email from ${APP_NAME} for ${options.schoolName}. Your SMTP configuration is working.`;
  const html = `<p>${text}</p>`;
  return { subject, text, html };
}
