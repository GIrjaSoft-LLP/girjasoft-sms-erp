import { z } from "zod";
import { ALL_PERMISSIONS } from "@/config/permissions";
import {
  ApiError,
  assertSameWorkspace,
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertAssignablePermissions } from "@/lib/rbac";
import { Role } from "@/models/identity";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "roles.edit");
    const { id } = await ctx.params;
    const role = await Role.findById(id);
    if (!role) throw new ApiError(404, "Role not found.");
    assertSameWorkspace(role.workspaceId, tenant.workspaceId);
    const body = z
      .object({
        name: z.string().optional(),
        department: z.string().optional(),
        description: z.string().optional(),
        permissions: z.array(z.string()).optional(),
      })
      .parse(await request.json());
    if (body.permissions) {
      const unknown = body.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (unknown.length) throw new ApiError(400, "Unknown permissions.");
      if (!tenant.impersonating) {
        assertAssignablePermissions(tenant.session.permissions, body.permissions);
      }
      role.permissions = body.permissions;
    }
    if (body.name) role.name = body.name;
    if (body.department !== undefined) role.department = body.department;
    if (body.description !== undefined) role.description = body.description;
    await role.save();
    await logWorkspace(tenant.session, tenant.workspaceId, "PERMISSION_MODIFIED", "roles", id);
    return json({ item: role });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "roles.delete");
    const { id } = await ctx.params;
    const role = await Role.findById(id);
    if (!role) throw new ApiError(404, "Role not found.");
    assertSameWorkspace(role.workspaceId, tenant.workspaceId);
    if (role.isSystem) throw new ApiError(400, "System roles cannot be deleted.");
    await role.deleteOne();
    await logWorkspace(tenant.session, tenant.workspaceId, "ROLE_DELETED", "roles", id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
