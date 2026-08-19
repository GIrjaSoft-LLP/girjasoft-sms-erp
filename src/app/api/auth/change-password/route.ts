import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { ApiError, errorResponse, json, requireSession } from "@/lib/api/guards";
import { logPlatform, logWorkspace } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isPlatformActor } from "@/lib/session";
import { PlatformAdmin } from "@/models/platform";
import { User } from "@/models/identity";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(10),
      })
      .parse(await request.json());

    if (isPlatformActor(session)) {
      const admin = await PlatformAdmin.findById(session.sub).select("+passwordHash");
      if (!admin) throw new ApiError(404, "Account not found.");
      const valid = await verifyPassword(body.currentPassword, admin.passwordHash);
      if (!valid) throw new ApiError(401, "Current password is incorrect.");
      admin.passwordHash = await hashPassword(body.newPassword);
      await admin.save();
      await logPlatform(session, "SUPER_ADMIN_PASSWORD_CHANGED");
      return json({ ok: true });
    }

    const user = await User.findById(session.sub).select("+passwordHash");
    if (!user) throw new ApiError(404, "Account not found.");
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot modify platform Super Admin.");
    }
    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(401, "Current password is incorrect.");
    user.passwordHash = await hashPassword(body.newPassword);
    await user.save();
    if (session.workspaceId) {
      await logWorkspace(session, session.workspaceId, "PASSWORD_CHANGED", "users", session.sub);
    }
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
