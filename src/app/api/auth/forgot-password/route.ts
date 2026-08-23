import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { connectMongo } from "@/lib/mongodb";
import { sendWorkspaceEmail, validateEmailClientForSend } from "@/lib/email/client";
import { readEmailClientFromSettings } from "@/lib/email/config";
import { buildPasswordResetEmail } from "@/lib/email/templates";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isWorkspaceExpired } from "@/lib/workspace-validity";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";
import { Settings } from "@/models/workspace";

const RESET_MINUTES = 60;
const GENERIC_MESSAGE =
  "If an account exists with this email address, a password reset link has been sent.";

const schema = z.object({
  email: z.string().min(3),
  workspaceCode: z.string().optional(),
});

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const body = schema.parse(await request.json());
    const identifier = body.email.trim().toLowerCase();
    const ip = clientIp(request);

    const ipLimit = checkRateLimit(`forgot:ip:${ip}`, 10, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return json({ message: GENERIC_MESSAGE });
    }
    const emailLimit = checkRateLimit(`forgot:email:${identifier}`, 3, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return json({ message: GENERIC_MESSAGE });
    }

    const userQuery: Record<string, unknown> = {
      $or: [{ email: identifier }, { username: identifier }],
      accountType: "WORKSPACE",
      status: "ACTIVE",
    };

    let workspaceCode = body.workspaceCode?.trim().toUpperCase() ?? "";
    if (workspaceCode) {
      const workspace = await Workspace.findOne({ code: workspaceCode });
      if (!workspace) return json({ message: GENERIC_MESSAGE });
      userQuery.workspaceId = workspace._id;
    }

    const matches = await User.find(userQuery);
    if (matches.length !== 1) {
      return json({ message: GENERIC_MESSAGE });
    }

    const user = matches[0];
    const workspace = await Workspace.findById(user.workspaceId);
    if (!workspace || workspace.status !== "ACTIVE" || isWorkspaceExpired(workspace.validityTill)) {
      return json({ message: GENERIC_MESSAGE });
    }

    const settings = await Settings.findOne({ workspaceId: workspace._id }).lean();
    const emailClient = readEmailClientFromSettings(settings);

    if (!emailClient.enabled) {
      return json({
        message: GENERIC_MESSAGE,
        serviceUnavailable:
          "Password reset email service is currently unavailable. Please contact your system administrator.",
      });
    }

    try {
      validateEmailClientForSend(emailClient);
    } catch {
      return json({
        message: GENERIC_MESSAGE,
        serviceUnavailable:
          "Password reset email service is currently unavailable. Please contact your system administrator.",
      });
    }

    const token = randomBytes(32).toString("base64url");
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpiresAt = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    await user.save();

    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}&workspace=${encodeURIComponent(workspace.code)}`;
    const mail = buildPasswordResetEmail({
      userName: user.name,
      schoolName: workspace.schoolName || workspace.name,
      resetUrl,
      expiresMinutes: RESET_MINUTES,
    });

    try {
      await sendWorkspaceEmail(emailClient, {
        to: user.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      user.resetTokenHash = null;
      user.resetTokenExpiresAt = null;
      await user.save();
      console.error("[forgot-password]", err instanceof Error ? err.message : "send failed");
      throw new ApiError(503, "Unable to send password reset email right now. Please try again later.");
    }

    await logWorkspace(
      {
        sub: String(user._id),
        email: user.email,
        name: user.name,
        accountType: "WORKSPACE",
        sessionRole: "WORKSPACE_USER",
        workspaceId: String(workspace._id),
        permissions: [],
        roleSlugs: [],
      },
      String(workspace._id),
      "PASSWORD_RESET_REQUESTED",
      "users",
      String(user._id),
    );

    return json({ message: GENERIC_MESSAGE });
  } catch (error) {
    return errorResponse(error);
  }
}
