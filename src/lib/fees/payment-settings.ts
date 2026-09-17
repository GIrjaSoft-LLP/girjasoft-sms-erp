import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { scopedQuery } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike } from "@/lib/rbac";
import { Settings } from "@/models/workspace";

export const PAYMENT_SETTING_KEYS = [
  "accountName",
  "bankName",
  "accountNumber",
  "ifscCode",
  "branch",
  "upiId",
  "qrCodeUrl",
] as const;

export type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number];

export type SchoolPaymentDetails = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  qrCodeUrl: string;
  currency: string;
};

export const paymentDetailsSchema = z.object({
  accountName: z.string().trim().max(160).optional(),
  bankName: z.string().trim().max(160).optional(),
  accountNumber: z.string().trim().max(40).optional(),
  ifscCode: z.string().trim().max(20).optional(),
  branch: z.string().trim().max(160).optional(),
  upiId: z.string().trim().max(80).optional(),
});

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function paymentDetailsFromFinance(finance: Record<string, unknown> | null | undefined): SchoolPaymentDetails {
  const data = finance ?? {};
  return {
    accountName: text(data.accountName),
    bankName: text(data.bankName),
    accountNumber: text(data.accountNumber),
    ifscCode: text(data.ifscCode),
    branch: text(data.branch),
    upiId: text(data.upiId),
    qrCodeUrl: text(data.qrCodeUrl),
    currency: text(data.currency) || "INR",
  };
}

export async function getWorkspacePaymentDetails(workspaceId: string) {
  const settings = await Settings.findOne(scopedQuery(workspaceId)).select("finance").lean();
  return paymentDetailsFromFinance((settings?.finance ?? {}) as Record<string, unknown>);
}

export function canConfigureFeePayments(ctx: TenantContext) {
  if (isParentLike(ctx.session.roleSlugs) || isStudentLike(ctx.session.roleSlugs)) {
    return false;
  }
  return (
    ctx.impersonating ||
    hasPermission(ctx.permissions, "fees.collect") ||
    hasPermission(ctx.permissions, "settings.edit")
  );
}

export function assertCanConfigureFeePayments(ctx: TenantContext) {
  if (!canConfigureFeePayments(ctx)) {
    throw new ApiError(403, "You do not have permission to configure fee payment details.");
  }
}
