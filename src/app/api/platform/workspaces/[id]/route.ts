import mongoose from "mongoose";
import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { Workspace } from "@/models/platform";
import { Role, User } from "@/models/identity";
import { excludePortalAccounts } from "@/lib/parent-account";
import { archiveWorkspace } from "@/lib/platform/workspace-archive";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requirePlatformPerm("platform.workspaces.view");
    const { id } = await ctx.params;
    const workspace = await Workspace.findById(id).lean();
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    const users = await User.find({ workspaceId: id, ...excludePortalAccounts() })
      .select("-passwordHash -resetTokenHash")
      .populate("roleIds", "name slug")
      .lean();
    return json({ item: workspace, users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.edit");
    const { id } = await ctx.params;
    const body = z
      .object({
        name: z.string().optional(),
        schoolName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        pinCode: z.string().optional(),
        website: z.string().optional(),
        logo: z.string().optional(),
        academicSession: z.string().optional(),
        validityTill: z.string().optional(),
        status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"]).optional(),
      })
      .parse(await request.json());
    const current = await Workspace.findById(id);
    if (!current) throw new ApiError(404, "Workspace not found.");
    const previousValidity = current.validityTill;
    if (body.validityTill) {
      current.validityTill = new Date(body.validityTill);
    }
    if (body.status === "ARCHIVED" && current.status !== "ARCHIVED") {
      const archived = await archiveWorkspace(session, id);
      return json({ item: archived.workspace });
    }
    if (current.status === "ARCHIVED" && body.status && body.status !== "ARCHIVED") {
      throw new ApiError(400, "Restore this workspace from Archived instead of changing its status here.");
    }
    Object.assign(current, { ...body, validityTill: current.validityTill, status: body.status ?? current.status });
    await current.save();
    if (body.validityTill) {
      await logPlatform(
        session,
        "WORKSPACE_VALIDITY_CHANGED",
        {
          code: current.code,
          previous: previousValidity ? new Date(previousValidity).toISOString().slice(0, 10) : "",
          next: current.validityTill ? new Date(current.validityTill).toISOString().slice(0, 10) : "",
        },
        id,
      );
    }
    await logPlatform(session, "WORKSPACE_UPDATED", body, id);
    return json({ item: current });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.delete");
    const { id } = await ctx.params;
    const archived = await archiveWorkspace(session, id);
    return json({ item: archived.workspace, userCount: archived.userCount });
  } catch (error) {
    return errorResponse(error);
  }
}

const resetSchema = z.object({
  password: z.string().min(10),
});

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const session = await requirePlatformPerm("platform.workspaces.manage");
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const workspace = await Workspace.findById(id);
    if (!workspace) throw new ApiError(404, "Workspace not found.");

    if (action === "reset-admin") {
      const { password } = resetSchema.parse(await request.json());
      if (!workspace.adminUserId) throw new ApiError(400, "Workspace admin missing.");
      const admin = await User.findOne({
        _id: workspace.adminUserId,
        workspaceId: workspace._id,
      }).select("+passwordHash");
      if (!admin) throw new ApiError(404, "Workspace admin not found.");
      if (admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        throw new ApiError(403, "Cannot modify platform Super Admin.");
      }
      admin.passwordHash = await hashPassword(password);
      admin.status = "ACTIVE";
      await admin.save();
      await logPlatform(session, "WORKSPACE_ADMIN_RESET", { email: admin.email }, id);
      return json({ ok: true });
    }

    throw new ApiError(400, "Unknown action.");
  } catch (error) {
    return errorResponse(error);
  }
}

export function toObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function loadAdminRole(workspaceId: string) {
  return Role.findOne({ workspaceId, slug: "workspace_admin" });
}
