import { cookies } from "next/headers";
import { z } from "zod";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { errorResponse, json, requireSession, ApiError } from "@/lib/api/guards";
import { logPlatform, logWorkspace } from "@/lib/audit";
import { connectMongo } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";
import { mergePermissions } from "@/lib/rbac";
import { resolveEffectivePermissions } from "@/lib/session-permissions";
import { enrichParentSession } from "@/lib/parent-access";
import { enrichTeacherSession } from "@/lib/teacher-context";
import { buildPlatformSession, ensurePlatformSystemRoles } from "@/lib/platform-access";
import { isWorkspaceExpired } from "@/lib/workspace-validity";
import { isWorkspaceArchived, WORKSPACE_ARCHIVED_LOGIN_MESSAGE } from "@/lib/platform/workspace-archive";
import {
  cookieOptions,
  SESSION_COOKIE,
  VIEW_WORKSPACE_COOKIE,
  signSession,
  type SessionPayload,
} from "@/lib/session";
import { PlatformAdmin, Workspace } from "@/models/platform";
import { Role, User } from "@/models/identity";

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
  workspaceCode: z.string().optional(),
});

async function buildWorkspaceSession(user: {
  _id: unknown;
  email: string;
  name: string;
  workspaceId: unknown;
  roleIds: unknown[];
  linkedStudentId?: unknown;
  linkedStudentIds?: unknown[];
  linkedTeacherId?: unknown;
  teacherContextClassId?: unknown;
  teacherContextSectionId?: unknown;
  teacherContextSubjectId?: unknown;
}): Promise<SessionPayload> {
  const roles = await Role.find({
    _id: { $in: user.roleIds },
    workspaceId: user.workspaceId,
  }).lean();
  const permissions = mergePermissions(roles.map((role) => role.permissions ?? []));
  return {
    sub: String(user._id),
    email: user.email,
    name: user.name,
    accountType: "WORKSPACE",
    sessionRole: "WORKSPACE_USER",
    workspaceId: String(user.workspaceId),
    permissions,
    roleSlugs: roles.map((role) => role.slug),
    linkedStudentId: user.linkedStudentId ? String(user.linkedStudentId) : null,
    linkedStudentIds: (user.linkedStudentIds ?? []).map((id) => String(id)),
    linkedTeacherId: user.linkedTeacherId ? String(user.linkedTeacherId) : null,
    teacherContextClassId: user.teacherContextClassId ? String(user.teacherContextClassId) : null,
    teacherContextSectionId: user.teacherContextSectionId ? String(user.teacherContextSectionId) : null,
    teacherContextSubjectId: user.teacherContextSubjectId ? String(user.teacherContextSubjectId) : null,
  };
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const parsed = loginSchema.parse(await request.json());
    const identifier = parsed.email.trim().toLowerCase();
    const store = await cookies();

    const platformAdmin = await PlatformAdmin.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+passwordHash");

    if (platformAdmin) {
      const valid = await verifyPassword(parsed.password, platformAdmin.passwordHash);
      if (!valid) {
        throw new ApiError(401, "Invalid credentials.");
      }
      if (platformAdmin.status !== "ACTIVE") {
        throw new ApiError(403, "Account disabled.");
      }
      platformAdmin.lastLoginAt = new Date();
      await platformAdmin.save();
      await ensurePlatformSystemRoles();
      const session = await buildPlatformSession(platformAdmin);
      const token = await signSession(session);
      store.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 12 });
      store.delete(VIEW_WORKSPACE_COOKIE);
      await logPlatform(session, "PLATFORM_LOGIN");
      return json({
        accountType: "PLATFORM",
        redirectTo: session.permissions.includes("platform.workspaces.view")
          ? "/platform/dashboard"
          : session.permissions.includes("platform.tickets.view")
            ? "/platform/tickets"
            : "/platform/settings",
        user: {
          name: session.name,
          email: session.email,
          accountType: session.accountType,
        },
      });
    }

    const userQuery: Record<string, unknown> = {
      $or: [{ email: identifier }, { username: identifier }],
      accountType: "WORKSPACE",
    };

    if (parsed.workspaceCode) {
      const workspace = await Workspace.findOne({
        code: parsed.workspaceCode.trim().toUpperCase(),
      });
      if (!workspace) throw new ApiError(401, "Invalid credentials.");
      userQuery.workspaceId = workspace._id;
    }

    const matches = await User.find(userQuery).select("+passwordHash");
    if (matches.length !== 1) {
      throw new ApiError(401, "Invalid credentials.");
    }
    const user = matches[0];
    const valid = await verifyPassword(parsed.password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid credentials.");
    const workspace = await Workspace.findById(user.workspaceId);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    if (isWorkspaceArchived(workspace.status) || user.status === "ARCHIVED") {
      throw new ApiError(403, WORKSPACE_ARCHIVED_LOGIN_MESSAGE);
    }
    if (user.status !== "ACTIVE") throw new ApiError(403, "Account disabled.");
    if (workspace.status !== "ACTIVE") {
      throw new ApiError(403, "Workspace is not active.");
    }
    if (isWorkspaceExpired(workspace.validityTill)) {
      throw new ApiError(403, "Workspace subscription has expired.");
    }

    user.lastLoginAt = new Date();
    await user.save();
    const session = await buildWorkspaceSession(user);
    const token = await signSession(session);
    store.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 12 });
    store.delete(VIEW_WORKSPACE_COOKIE);
    await logWorkspace(session, session.workspaceId!, "USER_LOGIN", "users", session.sub);
    return json({
      accountType: "WORKSPACE",
      redirectTo: session.roleSlugs.includes("parent")
        ? "/modules/student-info"
        : session.roleSlugs.includes("teacher")
          ? "/modules/teacher"
          : "/dashboard",
      user: {
        name: session.name,
        email: session.email,
        accountType: session.accountType,
        workspaceId: session.workspaceId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    let session = await requireSession();
    if (session.accountType === "PLATFORM") {
      return json({
        user: {
          name: session.name,
          email: session.email,
          accountType: session.accountType,
          sessionRole: session.sessionRole,
          permissions: session.permissions,
          roleSlugs: session.roleSlugs,
          photo: `/api/platform/profile/photo`,
        },
      });
    }
    const permissions = await resolveEffectivePermissions(session);
    if (session.workspaceId && session.roleSlugs?.includes("parent")) {
      session = await enrichParentSession(session, session.workspaceId);
    }
    if (session.workspaceId && session.roleSlugs?.includes("teacher")) {
      session = await enrichTeacherSession(session, session.workspaceId);
    }
    return json({
      user: {
        name: session.name,
        email: session.email,
        accountType: session.accountType,
        sessionRole: session.sessionRole,
        workspaceId: session.workspaceId,
        permissions,
        roleSlugs: session.roleSlugs,
        linkedStudentId: session.linkedStudentId,
        linkedStudentIds: session.linkedStudentIds,
        linkedTeacherId: session.linkedTeacherId,
        teacherContextClassId: session.teacherContextClassId,
        teacherContextSectionId: session.teacherContextSectionId,
        teacherContextSubjectId: session.teacherContextSubjectId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
