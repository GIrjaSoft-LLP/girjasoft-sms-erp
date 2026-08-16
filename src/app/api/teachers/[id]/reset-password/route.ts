import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { resetTeacherPassword } from "@/lib/teacher-account";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "teachers.edit");
    const { id } = await ctx.params;
    const login = await resetTeacherPassword(tenant.workspaceId, id);
    await logWorkspace(tenant.session, tenant.workspaceId, "TEACHER_PASSWORD_RESET", "teachers", id);
    return json({ login });
  } catch (error) {
    return errorResponse(error);
  }
}
