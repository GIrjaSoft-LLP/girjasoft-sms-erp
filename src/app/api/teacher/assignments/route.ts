import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { isTeacherLike } from "@/lib/rbac";
import { canManageTeacherAssignments } from "@/lib/teacher-class-assignments";
import { getTeacherAssignmentOptions } from "@/lib/teacher-context";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId") ?? ctx.session.linkedTeacherId;
    if (!teacherId) return json({ assignments: [] });

    const isSelf =
      isTeacherLike(ctx.session.roleSlugs) &&
      !ctx.impersonating &&
      ctx.session.linkedTeacherId === teacherId;

    if (!isSelf && !canManageTeacherAssignments(ctx.permissions)) {
      return json({ error: "Permission denied." }, 403);
    }

    const { assignments } = await getTeacherAssignmentOptions(ctx.workspaceId, teacherId);
    return json({ assignments });
  } catch (error) {
    return errorResponse(error);
  }
}
