import { ApiError, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { isTeacherSelfService } from "@/lib/hr/access";
import { getTeacherLeaveBalances } from "@/lib/hr/leave";
import { Teacher } from "@/models/workspace";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.view");
    const teacherId = new URL(request.url).searchParams.get("teacherId");
    const target = isTeacherSelfService(ctx) ? ctx.session.linkedTeacherId : teacherId ?? ctx.session.linkedTeacherId;
    if (isTeacherSelfService(ctx) && teacherId && teacherId !== ctx.session.linkedTeacherId) {
      throw new ApiError(403, "You can only view your own leave balance.");
    }
    if (!target) return json({ items: [], teacherName: "" });
    const teacher = await Teacher.findOne({ _id: target, workspaceId: ctx.workspaceId }).select("name").lean();
    return json({
      items: await getTeacherLeaveBalances(ctx, target),
      teacherName: teacher?.name ?? "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
