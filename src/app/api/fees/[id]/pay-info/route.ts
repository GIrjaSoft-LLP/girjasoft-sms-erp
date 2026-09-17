import { errorResponse, json, requireModuleEnabled, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { feePayInfo } from "@/lib/fees/collect";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requireModuleEnabled(tenant, "fees");
    requirePerm(tenant, "fees.view");
    const { id } = await ctx.params;
    return json(await feePayInfo(tenant, id));
  } catch (error) {
    return errorResponse(error);
  }
}
