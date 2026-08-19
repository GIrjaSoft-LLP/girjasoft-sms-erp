import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import type { AttendanceFilterType } from "@/lib/attendance/filters";
import { getAttendanceView } from "@/lib/attendance/service";

function parseViewParams(url: URL) {
  const filterType = (url.searchParams.get("filterType") ?? "month") as AttendanceFilterType;
  return {
    filterType,
    date: url.searchParams.get("date") ?? undefined,
    weekStart: url.searchParams.get("weekStart") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    academicSessionId: url.searchParams.get("academicSessionId") ?? undefined,
    classId: url.searchParams.get("classId") ?? undefined,
    sectionId: url.searchParams.get("sectionId") ?? undefined,
    studentId: url.searchParams.get("studentId") ?? undefined,
    subjectId: url.searchParams.get("subjectId") ?? undefined,
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    const url = new URL(request.url);
    const data = await getAttendanceView(ctx, parseViewParams(url));
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
