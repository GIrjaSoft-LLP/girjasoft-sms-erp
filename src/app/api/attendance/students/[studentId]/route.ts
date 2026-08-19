import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import type { AttendanceFilterType } from "@/lib/attendance/filters";
import { getStudentAttendanceSummary } from "@/lib/attendance/service";

function parseFilterParams(url: URL) {
  const filterType = url.searchParams.get("filterType") as AttendanceFilterType | null;
  return {
    filterType: filterType ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    weekStart: url.searchParams.get("weekStart") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
    const ctx = await requireAttendanceContext("attendance.view");
    const url = new URL(request.url);
    const data = await getStudentAttendanceSummary(ctx, studentId, parseFilterParams(url));
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
