import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import { getAttendanceSettings, saveAttendanceSettings } from "@/lib/attendance/settings";

export async function GET() {
  try {
    const ctx = await requireAttendanceContext("attendance.view");
    const settings = await getAttendanceSettings(ctx.workspaceId);
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.edit");
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await saveAttendanceSettings(ctx.workspaceId, body);
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}
