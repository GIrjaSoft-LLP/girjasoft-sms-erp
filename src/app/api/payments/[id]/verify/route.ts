import { z } from "zod";
import { errorResponse, json, requireModuleEnabled, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { paymentVerificationDetail, verifyParentPayment } from "@/lib/fees/collect";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requireModuleEnabled(tenant, "payments");
    requirePerm(tenant, "payments.view");
    const { id } = await ctx.params;
    return json(await paymentVerificationDetail(tenant, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const tenant = await requireWorkspaceContext();
    requireModuleEnabled(tenant, "payments");
    const { id } = await ctx.params;
    const body = z
      .object({
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(500).optional().default(""),
      })
      .parse(await request.json());
    const result = await verifyParentPayment(tenant, id, body.action, body.reason);
    await logWorkspace(
      tenant.session,
      tenant.workspaceId,
      body.action === "approve" ? "payments.verify.approve" : "payments.verify.reject",
      "payments",
      id,
      { reason: body.reason },
    );
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
