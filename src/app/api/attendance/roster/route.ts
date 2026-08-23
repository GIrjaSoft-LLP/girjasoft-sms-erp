import { errorResponse, json } from "@/lib/api/guards";
import { assertStaffAttendanceManagement, requireAttendanceContext } from "@/lib/attendance/guard";
import {
  getTeacherAttendanceMarkOptions,
  getSubjectsForClassSection,
  resolveAttendanceScopes,
} from "@/lib/attendance/scope";
import { getAttendanceRoster } from "@/lib/attendance/service";
import type { AttendanceType } from "@/config/attendance";

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    assertStaffAttendanceManagement(ctx);
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "scopes") {
      const scopes = await resolveAttendanceScopes(
        ctx.workspaceId,
        ctx.session,
        ctx.permissions,
        ctx.impersonating,
      );
      return json(scopes);
    }

    if (mode === "options") {
      const options = await getTeacherAttendanceMarkOptions(ctx);
      return json(options);
    }

    if (mode === "subjects") {
      const classId = url.searchParams.get("classId") ?? "";
      const sectionId = url.searchParams.get("sectionId") ?? "";
      const scopes = await resolveAttendanceScopes(
        ctx.workspaceId,
        ctx.session,
        ctx.permissions,
        ctx.impersonating,
      );
      const subjects = await getSubjectsForClassSection(
        ctx.workspaceId,
        classId,
        sectionId || undefined,
        scopes,
      );
      return json({
        subjects: subjects.map((subject) => ({
          _id: String(subject._id),
          name: subject.name,
          code: subject.code,
        })),
      });
    }

    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const classId = url.searchParams.get("classId") ?? "";
    const sectionId = url.searchParams.get("sectionId") ?? "";
    const attendanceType = (url.searchParams.get("attendanceType") ?? "CLASS") as AttendanceType;
    const subjectId = url.searchParams.get("subjectId");
    const academicSessionId = url.searchParams.get("academicSessionId");

    if (!classId || !sectionId) {
      return json({ error: "Class and section are required." }, 400);
    }

    const roster = await getAttendanceRoster(ctx, {
      date,
      classId,
      sectionId,
      attendanceType,
      subjectId,
      academicSessionId,
    });
    return json(roster);
  } catch (error) {
    return errorResponse(error);
  }
}
