import {
  ApiError,
  errorResponse,
  json,
  requireModuleEnabled,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { removePaymentQrFile, savePaymentQr } from "@/lib/fees/payment-files";
import { assertCanConfigureFeePayments, getWorkspacePaymentDetails } from "@/lib/fees/payment-settings";
import { Settings } from "@/models/workspace";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requireModuleEnabled(ctx, "fees");
    assertCanConfigureFeePayments(ctx);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      throw new ApiError(400, "Choose a QR code image to upload.");
    }
    let qrCodeUrl: string;
    try {
      qrCodeUrl = await savePaymentQr(ctx.workspaceId, file);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Upload failed");
    }
    await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: { "finance.qrCodeUrl": qrCodeUrl } },
      { upsert: true },
    );
    await logWorkspace(ctx.session, ctx.workspaceId, "fees.payment-qr.upload", "settings", ctx.workspaceId);
    return json({ payment: await getWorkspacePaymentDetails(ctx.workspaceId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireWorkspaceContext();
    requireModuleEnabled(ctx, "fees");
    assertCanConfigureFeePayments(ctx);
    await removePaymentQrFile(ctx.workspaceId);
    await Settings.findOneAndUpdate(
      scopedQuery(ctx.workspaceId),
      { $set: { "finance.qrCodeUrl": "" } },
      { upsert: true },
    );
    await logWorkspace(ctx.session, ctx.workspaceId, "fees.payment-qr.remove", "settings", ctx.workspaceId);
    return json({ payment: await getWorkspacePaymentDetails(ctx.workspaceId) });
  } catch (error) {
    return errorResponse(error);
  }
}
