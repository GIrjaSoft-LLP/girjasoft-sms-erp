import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import {
  getDailyAttendanceReport,
  getLowAttendanceReport,
  getMonthlyAttendanceReport,
  getStatusStudentReport,
} from "@/lib/attendance/service";
import type { AttendanceStatus } from "@/config/attendance";

export async function GET(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.reports");
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "low-attendance";

    if (type === "low-attendance") {
      const threshold = url.searchParams.get("threshold");
      const data = await getLowAttendanceReport(ctx, threshold ? Number(threshold) : undefined);
      return json(data);
    }

    if (type === "daily") {
      const date = url.searchParams.get("date") ?? undefined;
      return json(await getDailyAttendanceReport(ctx, date));
    }

    if (type === "monthly") {
      const month = url.searchParams.get("month") ?? undefined;
      return json(await getMonthlyAttendanceReport(ctx, month));
    }

    if (type === "absent" || type === "late" || type === "leave") {
      const statusMap: Record<string, AttendanceStatus> = {
        absent: "ABSENT",
        late: "LATE",
        leave: "LEAVE",
      };
      const from = url.searchParams.get("from") ?? undefined;
      const to = url.searchParams.get("to") ?? undefined;
      const attendanceType = (url.searchParams.get("attendanceType") as "CLASS" | "SUBJECT" | null) ?? "CLASS";
      return json(
        await getStatusStudentReport(ctx, statusMap[type], { from, to, attendanceType }),
      );
    }

    return json({ error: "Unknown report type." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
