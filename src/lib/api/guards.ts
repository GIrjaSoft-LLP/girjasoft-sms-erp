import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { ApiError } from "@/lib/api/errors";
import { getSession, getViewWorkspaceId, isPlatformActor, isPlatformSuperAdmin, type SessionPayload } from "@/lib/session";
import { hasPermission, isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { hasPlatformPermission } from "@/lib/platform-access";
import { ensureWorkspaceReady } from "@/lib/workspace-setup-server";
import { resolveWorkspacePermissionsForUser, shouldAllowAllModules } from "@/lib/session-permissions";
import { RESOURCE_TO_MODULE } from "@/config/erp-modules";
import { Workspace } from "@/models/platform";
import { isWorkspaceArchived, WORKSPACE_ARCHIVED_LOGIN_MESSAGE } from "@/lib/platform/workspace-archive";
import { omitSecrets } from "@/lib/sanitize";
import { enrichParentSession } from "@/lib/parent-access";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";

export { ApiError } from "@/lib/api/errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(omitSecrets(JSON.parse(JSON.stringify(data))), { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof error === "object" && error && "code" in error && error.code === 11000) {
    return json({ error: "Duplicate record for this workspace." }, 409);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json({ error: message }, 500);
}

export async function requireSession() {
  await connectMongo();
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "Authentication required.");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!isPlatformActor(session)) {
    throw new ApiError(403, "Platform access required.");
  }
  return session;
}

export async function requirePlatformSession() {
  const session = await requireSession();
  if (!isPlatformActor(session)) {
    throw new ApiError(403, "Platform access required.");
  }
  return session;
}

export async function requirePlatformPerm(permission: string) {
  const session = await requirePlatformSession();
  if (!hasPlatformPermission(session, permission)) {
    throw new ApiError(403, "Permission denied.");
  }
  return session;
}

export type TenantContext = {
  session: SessionPayload;
  workspaceId: string;
  impersonating: boolean;
  enabledModules: string[];
  /** Permissions resolved from roles (not stale JWT claims). */
  permissions: string[];
  allowAllModules: boolean;
};

export async function requireWorkspaceContext(): Promise<TenantContext> {
  let session = await requireSession();

  if (isPlatformActor(session)) {
    if (!hasPlatformPermission(session, "platform.workspaces.manage")) {
      throw new ApiError(403, "Permission denied.");
    }
    const viewId = await getViewWorkspaceId();
    if (!viewId) {
      throw new ApiError(403, "Open a workspace before accessing workspace data.");
    }
    const workspace = await Workspace.findById(viewId);
    if (!workspace) {
      throw new ApiError(404, "Workspace not found.");
    }
    if (isWorkspaceArchived(workspace.status)) {
      throw new ApiError(403, WORKSPACE_ARCHIVED_LOGIN_MESSAGE);
    }
    const enabledModules = await ensureWorkspaceReady(workspace);
    const allowAllModules = shouldAllowAllModules(session, true);
    return {
      session,
      workspaceId: String(workspace._id),
      impersonating: true,
      enabledModules,
      permissions: session.permissions,
      allowAllModules,
    };
  }

  if (!session.workspaceId) {
    throw new ApiError(403, "Workspace context missing.");
  }

  const workspace = await Workspace.findById(session.workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }
  if (isWorkspaceArchived(workspace.status)) {
    throw new ApiError(403, WORKSPACE_ARCHIVED_LOGIN_MESSAGE);
  }
  if (workspace.status !== "ACTIVE") {
    throw new ApiError(403, "Workspace is not active.");
  }

  const enabledModules = await ensureWorkspaceReady(workspace);
  const permissions = await resolveWorkspacePermissionsForUser(session.sub, String(workspace._id));
  const workspaceId = String(workspace._id);
  if (isParentLike(session.roleSlugs)) {
    session = await enrichParentSession(session, workspaceId);
  }
  return {
    session,
    workspaceId,
    impersonating: false,
    enabledModules,
    permissions,
    allowAllModules: false,
  };
}

export function requireModuleEnabled(ctx: TenantContext, resourceKey: string) {
  const moduleId = RESOURCE_TO_MODULE[resourceKey];
  if (!moduleId) return;
  if (!ctx.enabledModules.includes(moduleId)) {
    throw new ApiError(403, "This module is not enabled for your school.");
  }
}

export function requirePerm(ctx: TenantContext, permission: string) {
  if (ctx.impersonating && isPlatformActor(ctx.session) && hasPlatformPermission(ctx.session, "platform.workspaces.manage")) {
    return;
  }
  if (!hasPermission(ctx.permissions, permission)) {
    throw new ApiError(403, "Permission denied.");
  }
}

export function scopedQuery(workspaceId: string, extra: Record<string, unknown> = {}) {
  return { workspaceId: new mongoose.Types.ObjectId(workspaceId), ...extra };
}

export function applyRecordVisibility(
  ctx: TenantContext,
  resource: string,
  query: Record<string, unknown>,
) {
  if (ctx.impersonating) return query;
  const { session } = ctx;
  const studentScoped = [
    "students",
    "attendance",
    "homework",
    "timetable",
    "exams",
    "examSchedules",
    "marks",
    "results",
    "fees",
    "payments",
    "notices",
    "notifications",
  ];

  if (isStudentLike(session.roleSlugs) && studentScoped.includes(resource)) {
    if (!session.linkedStudentId) {
      throw new ApiError(403, "Student account is not linked.");
    }
    if (resource === "students") {
      query._id = new mongoose.Types.ObjectId(session.linkedStudentId);
    } else if (resource !== "notices" && resource !== "notifications" && resource !== "timetable" && resource !== "homework" && resource !== "exams") {
      query.studentId = new mongoose.Types.ObjectId(session.linkedStudentId);
    }
  }

  if (isParentLike(session.roleSlugs) && studentScoped.includes(resource)) {
    const ids = (session.linkedStudentIds ?? []).map((id) => new mongoose.Types.ObjectId(id));
    if (!ids.length) {
      throw new ApiError(403, "Parent account has no linked students.");
    }
    if (resource === "students") {
      query._id = { $in: ids };
    } else if (resource !== "notices" && resource !== "notifications" && resource !== "timetable" && resource !== "homework" && resource !== "exams") {
      query.studentId = { $in: ids };
    }
  }

  if (isTeacherLike(session.roleSlugs) && !isWorkspaceAdmin(ctx)) {
    if (resource === "teachers") {
      if (!hasPermission(session.permissions, "teachers.edit")) {
        if (!session.linkedTeacherId) {
          throw new ApiError(403, "Teacher account is not linked.");
        }
        query._id = new mongoose.Types.ObjectId(session.linkedTeacherId);
      }
    }
    if (resource === "leave") {
      if (!session.linkedTeacherId) {
        throw new ApiError(403, "Teacher account is not linked.");
      }
      query.teacherId = new mongoose.Types.ObjectId(session.linkedTeacherId);
    }
  }

  return query;
}

export function assertSameWorkspace(
  recordWorkspaceId: unknown,
  workspaceId: string,
) {
  if (String(recordWorkspaceId) !== String(workspaceId)) {
    throw new ApiError(403, "Forbidden.");
  }
}
