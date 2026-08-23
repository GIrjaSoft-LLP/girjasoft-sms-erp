import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { isTeacherLike } from "@/lib/rbac";
import { getTeacherAttendanceMarkOptions } from "@/lib/attendance/scope";
import { getAttendanceRoster } from "@/lib/attendance/service";
import type { AttendanceType } from "@/config/attendance";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    if (!isTeacherLike(ctx.session.roleSlugs) || ctx.impersonating) {
      return json({ error: "Teacher access required." }, 403);
    }
    if (!ctx.session.linkedTeacherId) {
      return json({ error: "Teacher account is not linked." }, 403);
    }

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const sectionId = url.searchParams.get("sectionId");

    if (classId && sectionId) {
      const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
      const attendanceType = (url.searchParams.get("attendanceType") ?? "CLASS") as AttendanceType;
      const subjectId = url.searchParams.get("subjectId");
      const roster = await getAttendanceRoster(ctx, {
        date,
        classId,
        sectionId,
        attendanceType,
        subjectId,
      });
      return json({
        students: roster.students,
        locked: roster.locked,
        submitted: roster.submitted,
        allowEdit: roster.allowEdit,
      });
    }

    const options = await getTeacherAttendanceMarkOptions(ctx);
    return json({
      classes: options.classes,
      sections: options.sections,
      subjects: options.subjects,
      settings: options.settings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
