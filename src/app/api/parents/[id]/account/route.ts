import { z } from "zod";
import { ApiError, assertSameWorkspace, errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { User } from "@/models/identity";
import { Parent } from "@/models/workspace";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "parents.edit");
    const { id } = await ctx.params;
    const parent = await Parent.findById(id);
    if (!parent) throw new ApiError(404, "Parent not found.");
    assertSameWorkspace(parent.workspaceId, tenant.workspaceId);
    const body = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }).parse(await request.json());
    const user = await User.findOne({ workspaceId: tenant.workspaceId, linkedParentId: parent._id });
    if (!user) throw new ApiError(404, "Parent login was not found.");
    user.status = body.status;
    parent.status = body.status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    await user.save();
    await parent.save();
    await logWorkspace(tenant.session, tenant.workspaceId, "PARENT_ACCOUNT_STATUS", "parents", id);
    return json({ ok: true, loginStatus: user.status });
  } catch (error) {
    return errorResponse(error);
  }
}
