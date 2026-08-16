import mongoose from "mongoose";
import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { DEFAULT_USER_PASSWORD } from "@/config/defaults";
import {
  ApiError,
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { assertAssignablePermissions } from "@/lib/rbac";
import { Role, User } from "@/models/identity";
import { staffUserQuery } from "@/lib/parent-account";

function hidePlatformAdmin<T extends { email?: string }>(users: T[]) {
  return users.filter(
    (user) => user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase(),
  );
}

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "users.view");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const query = await staffUserQuery(
      ctx.workspaceId,
      scopedQuery(ctx.workspaceId, {
        ...(status ? { status } : {}),
        ...(q
          ? {
              $or: [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
                { username: { $regex: q, $options: "i" } },
              ],
            }
          : {}),
      }),
    );
    const items = await User.find(query)
      .select("-passwordHash -resetTokenHash")
      .populate("roleIds", "name slug")
      .sort({ createdAt: -1 })
      .lean();
    return json({ items: hidePlatformAdmin(items as { email?: string }[]) });
  } catch (error) {
    return errorResponse(error);
  }
}

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  username: z.string().min(3),
  password: z.string().optional(),
  department: z.string().optional().default(""),
  employeeId: z.string().optional().default(""),
  roleIds: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "DISABLED"]).optional().default("ACTIVE"),
  linkedStudentId: z.string().nullable().optional(),
  linkedStudentIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "users.create");
    const body = userSchema.parse(await request.json());
    if (body.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(403, "Cannot create or reference the platform Super Admin.");
    }
    if (!body.password) {
      body.password = DEFAULT_USER_PASSWORD;
    }

    const roles = await Role.find({
      _id: { $in: body.roleIds },
      workspaceId: ctx.workspaceId,
    });
    if (roles.length !== body.roleIds.length) {
      throw new ApiError(400, "One or more roles are invalid for this workspace.");
    }
    if (roles.some((role) => ["parent", "student", "teacher"].includes(role.slug))) {
      throw new ApiError(400, "Create parent, student and teacher logins from their own sections.");
    }
    if (!ctx.impersonating) {
      assertAssignablePermissions(
        ctx.session.permissions,
        roles.flatMap((role) => role.permissions),
      );
    }

    const created = await User.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone,
      username: body.username.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      department: body.department,
      employeeId: body.employeeId || undefined,
      roleIds: body.roleIds,
      status: body.status,
      linkedStudentId: body.linkedStudentId || null,
      linkedStudentIds: body.linkedStudentIds ?? [],
    });
    await logWorkspace(ctx.session, ctx.workspaceId, "USER_CREATED", "users", String(created._id));
    return json({ item: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
