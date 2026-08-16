import { z } from "zod";
import { ApiError, assertSameWorkspace, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { User } from "@/models/identity";
import { Teacher } from "@/models/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "teachers.edit");
    const { id } = await ctx.params;
    const teacher = await Teacher.findById(id);
    if (!teacher) throw new ApiError(404, "Teacher not found.");
    assertSameWorkspace(teacher.workspaceId, tenant.workspaceId);
    const body = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }).parse(await request.json());
    const user = await User.findOne({ workspaceId: tenant.workspaceId, linkedTeacherId: teacher._id });
    if (!user) throw new ApiError(404, "Teacher login was not found.");
    user.status = body.status;
    teacher.status = body.status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    await user.save();
    await teacher.save();
    await logWorkspace(tenant.session, tenant.workspaceId, "TEACHER_ACCOUNT_STATUS", "teachers", id);
    return json({ ok: true, loginStatus: user.status });
  } catch (error) {
    return errorResponse(error);
  }
}
