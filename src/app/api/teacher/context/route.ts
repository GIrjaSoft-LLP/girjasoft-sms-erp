import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext } from "@/lib/api/guards";
import {
  getTeacherAssignmentOptions,
  getTodayTimetableSuggestions,
  hydrateTeacherContextLabels,
  loadTeacherContextFromUser,
} from "@/lib/teacher-context";
import { isTeacherLike } from "@/lib/rbac";

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
