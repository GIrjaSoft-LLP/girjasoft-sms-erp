import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { resetParentPassword } from "@/lib/parent-account";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requirePerm(tenant, "parents.edit");
    const { id } = await ctx.params;
    const login = await resetParentPassword(tenant.workspaceId, id);
    await logWorkspace(tenant.session, tenant.workspaceId, "PARENT_PASSWORD_RESET", "parents", id);
    return json({ login });
  } catch (error) {
    return errorResponse(error);
  }
}
