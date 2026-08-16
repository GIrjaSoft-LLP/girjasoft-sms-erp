import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { getSession, getViewWorkspaceId, isPlatformSuperAdmin, type SessionPayload } from "@/lib/session";
import { hasPermission, isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { Workspace } from "@/models/platform";
import { omitSecrets } from "@/lib/sanitize";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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
  if (!isPlatformSuperAdmin(session)) {
    throw new ApiError(403, "Platform Super Admin access required.");
  }
  return session;
}

export type TenantContext = {
  session: SessionPayload;
  workspaceId: string;
  impersonating: boolean;
};

export async function requireWorkspaceContext(): Promise<TenantContext> {
  const session = await requireSession();

  if (isPlatformSuperAdmin(session)) {
    const viewId = await getViewWorkspaceId();
    if (!viewId) {
      throw new ApiError(403, "Open a workspace before accessing workspace data.");
    }
    const workspace = await Workspace.findById(viewId);
    if (!workspace) {
      throw new ApiError(404, "Workspace not found.");
    }
    return {
      session,
      workspaceId: String(workspace._id),
      impersonating: true,
    };
  }

  if (!session.workspaceId) {
    throw new ApiError(403, "Workspace context missing.");
  }

  const workspace = await Workspace.findById(session.workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found.");
  }
  if (workspace.status !== "ACTIVE") {
    throw new ApiError(403, "Workspace is not active.");
  }

  return {
    session,
    workspaceId: String(workspace._id),
    impersonating: false,
  };
}

export function requirePerm(ctx: TenantContext, permission: string) {
  if (ctx.impersonating && isPlatformSuperAdmin(ctx.session)) {
    return;
  }
  if (!hasPermission(ctx.session.permissions, permission)) {
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

  if (isTeacherLike(session.roleSlugs) && resource === "teachers") {
    if (!hasPermission(session.permissions, "teachers.edit")) {
      if (!session.linkedTeacherId) {
        throw new ApiError(403, "Teacher account is not linked.");
      }
      query._id = new mongoose.Types.ObjectId(session.linkedTeacherId);
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
