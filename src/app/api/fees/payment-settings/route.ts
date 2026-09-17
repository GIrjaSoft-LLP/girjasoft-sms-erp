import {
  errorResponse,
  json,
  requireModuleEnabled,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import {
  assertCanConfigureFeePayments,
  getWorkspacePaymentDetails,
  paymentDetailsSchema,
} from "@/lib/fees/payment-settings";
import { Settings } from "@/models/workspace";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requireModuleEnabled(ctx, "fees");
    requirePerm(ctx, "fees.view");
    const payment = await getWorkspacePaymentDetails(ctx.workspaceId);
    return json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requireModuleEnabled(ctx, "fees");
    assertCanConfigureFeePayments(ctx);
    const body = paymentDetailsSchema.parse(await request.json());
    const $set: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) $set[`finance.${key}`] = value;
    }
    const settings = await Settings.findOneAndUpdate(scopedQuery(ctx.workspaceId), { $set }, { new: true, upsert: true });
    await logWorkspace(ctx.session, ctx.workspaceId, "fees.payment-settings.update", "settings", String(settings._id));
    return json({ payment: await getWorkspacePaymentDetails(ctx.workspaceId) });
  } catch (error) {
    return errorResponse(error);
  }
}
