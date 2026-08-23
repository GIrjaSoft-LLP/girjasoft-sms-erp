import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { isTeacherLike } from "@/lib/rbac";
import {
  canManageTeacherAssignments,
  getTeacherAssignmentAdminView,
  previewClassAssignmentDetails,
  syncTeacherClassAssignments,
} from "@/lib/teacher-class-assignments";
import { Teacher } from "@/models/workspace";

function assertCanViewTeacherAssignments(
  ctx: Awaited<ReturnType<typeof requireWorkspaceContext>>,
  teacherId: string,
) {
  const isSelf =
    isTeacherLike(ctx.session.roleSlugs) &&
    !ctx.impersonating &&
    ctx.session.linkedTeacherId === teacherId;

  if (isSelf) return;
  if (canManageTeacherAssignments(ctx.permissions)) return;
  requirePerm(ctx, "teachers.view");
}

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");
    const previewClassIds = url.searchParams.get("classIds");

    if (previewClassIds) {
      requirePerm(ctx, "teachers.view");
      const classIds = previewClassIds.split(",").map((id) => id.trim()).filter(Boolean);
      const preview = await previewClassAssignmentDetails(ctx.workspaceId, classIds);
      return json({ preview });
    }

    if (!teacherId) {
      requirePerm(ctx, "teachers.view");
      const teachers = await Teacher.find({ workspaceId: ctx.workspaceId, status: { $ne: "INACTIVE" } })
        .sort({ name: 1 })
        .select("name employeeId email status")
        .lean();
      return json({
        teachers: teachers.map((row) => ({
          _id: String(row._id),
          name: row.name,
          employeeId: row.employeeId,
          email: row.email ?? "",
          status: row.status,
        })),
      });
    }

    assertCanViewTeacherAssignments(ctx, teacherId);
    const data = await getTeacherAssignmentAdminView(ctx.workspaceId, teacherId);
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    if (!canManageTeacherAssignments(ctx.permissions)) {
      requirePerm(ctx, "teachers.assign");
    }

    const body = (await request.json()) as { teacherId?: string; classIds?: string[] };
    if (!body.teacherId) {
      return json({ error: "Teacher is required." }, 400);
    }

    const classIds = Array.isArray(body.classIds) ? body.classIds : [];
    const data = await syncTeacherClassAssignments(ctx.workspaceId, body.teacherId, classIds);
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
