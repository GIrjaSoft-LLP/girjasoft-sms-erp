import mongoose from "mongoose";
import { z } from "zod";
import { ALL_PERMISSIONS, PERMISSION_MODULES } from "@/config/permissions";
import {
  ApiError,
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { assertAssignablePermissions } from "@/lib/rbac";
import { Role } from "@/models/identity";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "roles.view");
    const items = await Role.find(scopedQuery(ctx.workspaceId)).sort({ name: 1 }).lean();
    return json({ items, catalog: PERMISSION_MODULES, allPermissions: ALL_PERMISSIONS });
  } catch (error) {
    return errorResponse(error);
  }
}

const roleSchema = z.object({
  name: z.string().min(2),
  department: z.string().optional().default(""),
  description: z.string().optional().default(""),
  permissions: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "roles.create");
    const body = roleSchema.parse(await request.json());
    const unknown = body.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (unknown.length) throw new ApiError(400, "Unknown permissions.");
    if (!ctx.impersonating) {
      assertAssignablePermissions(ctx.session.permissions, body.permissions);
    }
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const created = await Role.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      name: body.name,
      slug,
      department: body.department,
      description: body.description,
      permissions: body.permissions,
      isSystem: false,
    });
    await logWorkspace(ctx.session, ctx.workspaceId, "ROLE_CREATED", "roles", String(created._id));
    return json({ item: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
