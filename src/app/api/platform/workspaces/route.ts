import { cookies } from "next/headers";
import mongoose from "mongoose";
import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import {
  ApiError,
  errorResponse,
  json,
  requireSuperAdmin,
} from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { initializeWorkspace, nextWorkspaceCode } from "@/lib/workspace-bootstrap";
import {
  cookieOptions,
  VIEW_WORKSPACE_COOKIE,
} from "@/lib/session";
import { PlatformAuditLog, Workspace } from "@/models/platform";
import { Role, User } from "@/models/identity";
import { excludePortalAccounts } from "@/lib/parent-account";
import {
  Student,
  Teacher,
  Staff,
} from "@/models/workspace";

const workspaceSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  schoolName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  country: z.string().optional().default("India"),
  pinCode: z.string().optional().default(""),
  website: z.string().optional().default(""),
  logo: z.string().optional().default(""),
  academicSession: z.string().optional().default(""),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"]).optional().default("ACTIVE"),
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().default(""),
    username: z.string().min(3),
    password: z.string().min(10),
  }),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const workspaces = await Workspace.find().sort({ createdAt: -1 }).lean();
    const rows = await Promise.all(
      workspaces.map(async (workspace) => {
        const workspaceId = workspace._id;
        const [users, students, admin] = await Promise.all([
          User.countDocuments({ workspaceId, ...excludePortalAccounts() }),
          Student.countDocuments({ workspaceId }),
          workspace.adminUserId
            ? User.findOne({ _id: workspace.adminUserId, workspaceId }).select("name email")
            : User.findOne({ workspaceId }).populate("roleIds"),
        ]);
        return {
          ...workspace,
          users,
          students,
          admin: admin ? { name: admin.name, email: admin.email } : null,
        };
      }),
    );
    return json({ items: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const body = workspaceSchema.parse(await request.json());
    if (body.admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new ApiError(400, "Cannot use the platform Super Admin email.");
    }

    const existingCodes = (await Workspace.find().select("code").lean()).map((w) => w.code);
    const code = (body.code || nextWorkspaceCode(existingCodes)).toUpperCase();
    const duplicate = await Workspace.findOne({ code });
    if (duplicate) throw new ApiError(409, "Workspace code already exists.");

    const workspace = await Workspace.create({
      name: body.name,
      code,
      schoolName: body.schoolName,
      email: body.email,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      country: body.country,
      pinCode: body.pinCode,
      website: body.website,
      logo: body.logo,
      academicSession: body.academicSession,
      status: body.status,
    });

    await initializeWorkspace(String(workspace._id), body.schoolName);
    const adminRole = await Role.findOne({
      workspaceId: workspace._id,
      slug: "workspace_admin",
    });
    if (!adminRole) throw new ApiError(500, "Default roles failed to initialize.");

    const admin = await User.create({
      workspaceId: workspace._id,
      name: body.admin.name,
      email: body.admin.email.toLowerCase(),
      phone: body.admin.phone,
      username: body.admin.username.toLowerCase(),
      passwordHash: await hashPassword(body.admin.password),
      department: "Administration",
      roleIds: [adminRole._id],
      status: "ACTIVE",
      accountType: "WORKSPACE",
    });

    workspace.adminUserId = admin._id as mongoose.Types.ObjectId;
    await workspace.save();
    await logPlatform(session, "WORKSPACE_CREATED", { code, schoolName: body.schoolName }, String(workspace._id));
    await logPlatform(session, "WORKSPACE_ADMIN_CREATED", { email: admin.email }, String(workspace._id));

    return json({ item: workspace }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
