import { errorResponse, json } from "@/lib/api/guards";
import { ApiError, requireWorkspaceContext } from "@/lib/api/guards";
import {
  attachTeacherContextToSession,
  enrichTeacherSession,
  getTeacherAssignmentOptions,
  getTodayTimetableSuggestions,
  hydrateTeacherContextLabels,
  loadTeacherContextFromUser,
  saveTeacherContext,
} from "@/lib/teacher-context";
import { isTeacherLike } from "@/lib/rbac";
import { cookieOptions, SESSION_COOKIE, signSession, type SessionPayload } from "@/lib/session";
import { cookies } from "next/headers";
import { z } from "zod";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    if (!isTeacherLike(ctx.session.roleSlugs) || !ctx.session.linkedTeacherId) {
      return json({ assignments: [], todaySchedule: [], teacherName: ctx.session.name });
    }
    const teacherId = ctx.session.linkedTeacherId;
    const [{ assignments }, todaySchedule, stored] = await Promise.all([
      getTeacherAssignmentOptions(ctx.workspaceId, teacherId),
      getTodayTimetableSuggestions(ctx.workspaceId, teacherId),
      loadTeacherContextFromUser(ctx.session.sub),
    ]);
    let previousContext = null;
    if (stored?.classId && stored?.sectionId) {
      const labels = await hydrateTeacherContextLabels(ctx.workspaceId, stored);
      const candidate = { ...stored, ...labels };
      const stillAllowed = assignments.some(
        (item) =>
          item.classId === candidate.classId &&
          item.sectionId === candidate.sectionId &&
          (!candidate.subjectId || item.subjectId === candidate.subjectId || item.kind === "CLASS"),
      );
      if (stillAllowed) previousContext = candidate;
    }
    return json({ assignments, todaySchedule, previousContext, teacherName: ctx.session.name });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    if (!isTeacherLike(ctx.session.roleSlugs) || !ctx.session.linkedTeacherId) {
      throw new ApiError(403, "Teacher account is not linked.");
    }
    const body = z
      .object({
        classId: z.string().min(1),
        sectionId: z.string().min(1),
        subjectId: z.string().optional(),
      })
      .parse(await request.json());

    const workspaceId = ctx.workspaceId;
    const teacherId = ctx.session.linkedTeacherId;

    await saveTeacherContext(ctx.session.sub, workspaceId, teacherId, body);

    const stored = await loadTeacherContextFromUser(ctx.session.sub);
    const labels = await hydrateTeacherContextLabels(workspaceId, {
      classId: body.classId,
      sectionId: body.sectionId,
      subjectId: body.subjectId ?? stored?.subjectId ?? null,
    });

    let session: SessionPayload = attachTeacherContextToSession(ctx.session, {
      classId: body.classId,
      sectionId: body.sectionId,
      subjectId: body.subjectId ?? stored?.subjectId ?? "",
    });
    session = await enrichTeacherSession(session, workspaceId);

    const token = await signSession(session);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 12 });

    return json({
      ok: true,
      context: {
        classId: body.classId,
        sectionId: body.sectionId,
        subjectId: body.subjectId ?? stored?.subjectId ?? null,
        ...labels,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
