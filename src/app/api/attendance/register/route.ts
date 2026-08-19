import { errorResponse, json } from "@/lib/api/guards";
import { assertStaffAttendanceManagement, requireAttendanceContext } from "@/lib/attendance/guard";
import { getAttendanceRegister } from "@/lib/attendance/service";
import type { AttendanceType } from "@/config/attendance";

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    assertStaffAttendanceManagement(ctx);
    const url = new URL(request.url);
    const rows = await getAttendanceRegister(ctx, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      classId: url.searchParams.get("classId") ?? undefined,
      sectionId: url.searchParams.get("sectionId") ?? undefined,
      subjectId: url.searchParams.get("subjectId") ?? undefined,
      attendanceType: (url.searchParams.get("attendanceType") as AttendanceType | "") ?? "",
      status: url.searchParams.get("status") ?? undefined,
    });
    return json({ rows });
  } catch (error) {
    return errorResponse(error);
  }
}
