import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import {
  ApiError,
  assertSameWorkspace,
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { assertStaffManagedUser } from "@/lib/parent-account";
import { Role, User } from "@/models/identity";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "users.edit");
    const { id } = await ctx.params;
    const user = await User.findById(id).select("+passwordHash");
    if (!user) throw new ApiError(404, "User not found.");
    assertSameWorkspace(user.workspaceId, tenant.workspaceId);
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot modify platform Super Admin.");
    }
    await assertStaffManagedUser(tenant.workspaceId, user);
    const body = z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        employeeId: z.string().optional(),
        roleIds: z.array(z.string()).optional(),
        status: z.enum(["ACTIVE", "DISABLED"]).optional(),
        password: z.string().min(10).optional(),
        linkedStudentId: z.string().nullable().optional(),
        linkedStudentIds: z.array(z.string()).optional(),
      })
      .parse(await request.json());

    if (body.name) user.name = body.name;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.department !== undefined) user.department = body.department;
    if (body.employeeId !== undefined) user.employeeId = body.employeeId || undefined;
    if (body.roleIds) {
      const roles = await Role.find({ _id: { $in: body.roleIds }, workspaceId: tenant.workspaceId });
      if (roles.length !== body.roleIds.length) {
        throw new ApiError(400, "One or more roles are invalid for this workspace.");
      }
      if (roles.some((role) => ["parent", "student", "teacher"].includes(role.slug))) {
        throw new ApiError(400, "Parent, student and teacher logins are managed from their own sections.");
      }
      user.roleIds = body.roleIds;
    }
    if (body.status) user.status = body.status;
    if (body.linkedStudentId !== undefined) user.linkedStudentId = body.linkedStudentId;
    if (body.linkedStudentIds) user.linkedStudentIds = body.linkedStudentIds;
    if (body.password) user.passwordHash = await hashPassword(body.password);
    await user.save();
    await logWorkspace(tenant.session, tenant.workspaceId, "USER_UPDATED", "users", id);
    return json({ item: user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "users.delete");
    const { id } = await ctx.params;
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found.");
    assertSameWorkspace(user.workspaceId, tenant.workspaceId);
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot delete platform Super Admin.");
    }
    await assertStaffManagedUser(tenant.workspaceId, user);
    if (String(user._id) === tenant.session.sub && !tenant.impersonating) {
      throw new ApiError(400, "You cannot remove your own account.");
    }
    await user.deleteOne();
    await logWorkspace(tenant.session, tenant.workspaceId, "USER_DELETED", "users", id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
