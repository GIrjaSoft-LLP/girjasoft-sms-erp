import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaceUsers.edit");
    const { id } = await ctx.params;
    const user = await User.findById(id).select("+passwordHash");
    if (!user) throw new ApiError(404, "User not found.");
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot modify platform Super Admin.");
    }
    const body = z
      .object({
        password: z.string().min(10).optional(),
        status: z.enum(["ACTIVE", "DISABLED"]).optional(),
      })
      .parse(await request.json());
    if (body.status === "ACTIVE") {
      const workspace = await Workspace.findById(user.workspaceId).select("status");
      if (workspace?.status === "ARCHIVED" || user.status === "ARCHIVED") {
        throw new ApiError(400, "Restore the archived workspace before reactivating this user.");
      }
    }
    if (body.password) user.passwordHash = await hashPassword(body.password);
    if (body.status) user.status = body.status;
    await user.save();
    await logPlatform(
      session,
      "WORKSPACE_USER_UPDATED",
      { email: user.email },
      String(user.workspaceId),
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaceUsers.delete");
    const { id } = await ctx.params;
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found.");
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot remove platform Super Admin.");
    }
    const email = user.email;
    const workspaceId = String(user.workspaceId);
    await user.deleteOne();
    await logPlatform(session, "WORKSPACE_USER_REMOVED", { email }, workspaceId);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
