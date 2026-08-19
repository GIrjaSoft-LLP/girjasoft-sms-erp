import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";
import { User } from "@/models/identity";
import { Parent, Student } from "@/models/workspace";

export function studentIdAllowed(linkedIds: string[], studentId: string) {
  return linkedIds.some((id) => String(id) === String(studentId));
}

/** Resolve linked children from Parent record (source of truth), then User, then session JWT. */
export async function resolveLinkedStudentIds(session: SessionPayload, workspaceId: string) {
  if (!isParentLike(session.roleSlugs)) {
    return (session.linkedStudentIds ?? []).map(String);
  }

  const user = await User.findOne({ _id: session.sub, workspaceId })
    .select("linkedParentId linkedStudentIds linkedStudentId")
    .lean();

  if (user?.linkedParentId) {
    const parent = await Parent.findOne({ _id: user.linkedParentId, workspaceId })
      .select("studentIds")
      .lean();
    if (parent?.studentIds?.length) {
      const ids = parent.studentIds.map(String);
      const active = await Student.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        _id: { $in: parent.studentIds },
      })
        .select("_id")
        .lean();
      if (active.length) return active.map((row) => String(row._id));
      return ids;
    }
  }

  if (user?.linkedStudentIds?.length) {
    return user.linkedStudentIds.map(String);
  }

  return (session.linkedStudentIds ?? []).map(String);
}

export async function enrichParentSession(session: SessionPayload, workspaceId: string): Promise<SessionPayload> {
  if (!isParentLike(session.roleSlugs)) return session;
  const linkedStudentIds = await resolveLinkedStudentIds(session, workspaceId);
  const linkedStudentId =
    session.linkedStudentId && studentIdAllowed(linkedStudentIds, session.linkedStudentId)
      ? String(session.linkedStudentId)
      : linkedStudentIds[0] ?? null;

  const user = await User.findOne({ _id: session.sub, workspaceId }).select("linkedStudentIds linkedStudentId").lean();
  if (user) {
    const current = (user.linkedStudentIds ?? []).map(String).sort().join(",");
    const next = linkedStudentIds.slice().sort().join(",");
    if (current !== next || String(user.linkedStudentId ?? "") !== String(linkedStudentId ?? "")) {
      await User.findByIdAndUpdate(session.sub, {
        $set: {
          linkedStudentIds: linkedStudentIds.map((id: string) => new mongoose.Types.ObjectId(id)),
          linkedStudentId: linkedStudentId ? new mongoose.Types.ObjectId(linkedStudentId) : null,
        },
      });
    }
  }

  return { ...session, linkedStudentIds, linkedStudentId };
}

export async function assertPortalCanViewStudent(ctx: TenantContext, studentId: string) {
  if (ctx.impersonating) return;

  const student = await Student.findOne({ _id: studentId, workspaceId: ctx.workspaceId }).select("_id").lean();
  if (!student) throw new ApiError(404, "Student not found.");

  if (isParentLike(ctx.session.roleSlugs)) {
    const allowed = ctx.session.linkedStudentIds ?? [];
    if (!allowed.length) {
      const resolved = await resolveLinkedStudentIds(ctx.session, ctx.workspaceId);
      if (!studentIdAllowed(resolved, studentId)) {
        throw new ApiError(403, "Forbidden.");
      }
      return;
    }
    if (!studentIdAllowed(allowed, studentId)) {
      throw new ApiError(403, "Forbidden.");
    }
    return;
  }

  if (isStudentLike(ctx.session.roleSlugs)) {
    if (String(ctx.session.linkedStudentId) !== String(studentId)) {
      throw new ApiError(403, "Forbidden.");
    }
  }
}
