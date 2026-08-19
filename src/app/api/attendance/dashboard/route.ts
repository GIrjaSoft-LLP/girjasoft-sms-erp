import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import { getAttendanceDashboard } from "@/lib/attendance/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId") ?? undefined;
    const data = await getAttendanceDashboard(ctx, { studentId });
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
