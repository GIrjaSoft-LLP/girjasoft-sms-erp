import { errorResponse, json, requireModuleEnabled, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { submitParentReceipt } from "@/lib/fees/collect";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requireModuleEnabled(tenant, "fees");
    requirePerm(tenant, "fees.view");
    const { id } = await ctx.params;
    const result = await submitParentReceipt(tenant, id, await request.formData());
    await logWorkspace(tenant.session, tenant.workspaceId, "fees.receipt.upload", "payments", String(result.item._id));
    return json({ message: "Receipt submitted for verification.", item: result.item }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
