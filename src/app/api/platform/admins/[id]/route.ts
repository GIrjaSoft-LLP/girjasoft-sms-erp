import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { assertNotLastAdmin } from "@/lib/platform-access";
import { hashPassword } from "@/lib/password";
import { removeProfilePhoto } from "@/lib/profile-photo";
import { PlatformAdmin } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.users.edit");
    const { id } = await ctx.params;
    const admin = await PlatformAdmin.findById(id).select("+passwordHash");
    if (!admin) throw new ApiError(404, "User not found.");
    const body = z
      .object({
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
        role: z.enum(["ADMIN", "READER", "TICKET_ADMIN", "SUPER_ADMIN"]).optional(),
        status: z.enum(["ACTIVE", "DISABLED"]).optional(),
        password: z.string().min(10).optional(),
      })
      .parse(await request.json());
    const isOwner = admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isOwner && body.role && body.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Cannot change the owner account role.");
    }
    if (body.role && body.role !== admin.role) {
      if (session.sub === String(admin._id)) {
        throw new ApiError(403, "You cannot change your own role.");
      }
      if (["SUPER_ADMIN", "ADMIN", "admin"].includes(String(admin.role))) {
        await assertNotLastAdmin(admin);
      }
    }
    if (body.status === "DISABLED" && ["SUPER_ADMIN", "ADMIN", "admin"].includes(String(admin.role))) {
      await assertNotLastAdmin(admin);
    }
    if (body.name) admin.name = body.name;
    if (body.phone !== undefined) admin.phone = body.phone;
    if (body.role && !isOwner) admin.role = body.role;
    if (body.status) admin.status = body.status;
    if (body.password) admin.passwordHash = await hashPassword(body.password);
    await admin.save();
    await logPlatform(session, "PLATFORM_USER_UPDATED", { email: admin.email, role: admin.role });
    return json({ item: admin });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.users.delete");
    const { id } = await ctx.params;
    const admin = await PlatformAdmin.findById(id);
    if (!admin) throw new ApiError(404, "User not found.");
    if (admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot remove the owner account.");
    }
    await assertNotLastAdmin(admin);
    await removeProfilePhoto("platform", "platform", id);
    await admin.deleteOne();
    await logPlatform(session, "PLATFORM_USER_REMOVED", { email: admin.email });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
