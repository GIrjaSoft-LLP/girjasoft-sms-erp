import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { scopedQuery } from "@/lib/api/guards";
import { hasPermission, isParentLike } from "@/lib/rbac";
import { assertPortalCanViewStudent } from "@/lib/parent-access";
import { FeePayment, FeeStructure, SchoolClass, Section, Settings, Student, StudentFee } from "@/models/workspace";
import { getWorkspacePaymentDetails } from "@/lib/fees/payment-settings";
import { saveFeeReceiptFile } from "@/lib/fees/payment-files";

export const PAYMENT_METHODS = ["UPI", "BANK", "QR", "OTHER", "CASH", "CARD"] as const;

const receiptUploadSchema = z.object({
  amount: z.number().positive(),
  date: z.string().trim().min(1).max(32),
  method: z.enum(PAYMENT_METHODS),
  transactionRef: z.string().trim().max(80).default(""),
});

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export function outstandingAmount(fee: { amount?: unknown; paidAmount?: unknown }) {
  const amount = Number(fee.amount ?? 0);
  const paid = Number(fee.paidAmount ?? 0);
  return Math.max(0, Math.round((amount - paid) * 100) / 100);
}

export function statusFromPaid(amount: number, paidAmount: number) {
  if (paidAmount <= 0) return "PENDING";
  if (paidAmount + 0.0001 >= amount) return "PAID";
  return "PARTIAL";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function nextReceiptNumber(workspaceId: string, kind: "PV" | "RC") {
  const settings = await Settings.findOne(scopedQuery(workspaceId)).select("finance").lean();
  const prefix = String((settings?.finance as { receiptPrefix?: string } | undefined)?.receiptPrefix ?? "GS")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8) || "GS";
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${kind}-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function loadVisibleStudentFee(ctx: TenantContext, feeId: string) {
  if (!mongoose.isValidObjectId(feeId)) {
    throw new ApiError(400, "Invalid fee.");
  }
  const fee = await StudentFee.findOne(scopedQuery(ctx.workspaceId, { _id: feeId })).lean();
  if (!fee) throw new ApiError(404, "Fee not found.");
  await assertPortalCanViewStudent(ctx, String(fee.studentId));
  return fee;
}

export async function feePayInfo(ctx: TenantContext, feeId: string) {
  const fee = await loadVisibleStudentFee(ctx, feeId);
  const student = await Student.findOne(scopedQuery(ctx.workspaceId, { _id: fee.studentId }))
    .select("name admissionNumber classId sectionId")
    .lean();
  if (!student) throw new ApiError(404, "Student not found.");
  const [classDoc, sectionDoc, structure, payment, review] = await Promise.all([
    student.classId
      ? SchoolClass.findOne(scopedQuery(ctx.workspaceId, { _id: student.classId })).select("name").lean()
      : null,
    student.sectionId
      ? Section.findOne(scopedQuery(ctx.workspaceId, { _id: student.sectionId })).select("name").lean()
      : null,
    fee.feeStructureId
      ? FeeStructure.findOne(scopedQuery(ctx.workspaceId, { _id: fee.feeStructureId })).select("name").lean()
      : null,
    getWorkspacePaymentDetails(ctx.workspaceId),
    FeePayment.findOne({
      workspaceId: oid(ctx.workspaceId),
      studentFeeId: fee._id,
      verificationStatus: { $in: ["PENDING_VERIFICATION", "REJECTED"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const dueAmount = outstandingAmount(fee);
  return {
    fee: {
      _id: String(fee._id),
      studentId: String(fee.studentId),
      studentName: student.name ?? "",
      admissionNumber: student.admissionNumber ?? "",
      className: classDoc?.name ?? "",
      sectionName: sectionDoc?.name ?? "",
      feeHead: structure?.name || fee.description || "Fee",
      description: fee.description ?? "",
      amount: fee.amount,
      paidAmount: fee.paidAmount ?? 0,
      dueAmount,
      status: fee.status,
      dueDate: fee.dueDate ?? "",
    },
    payment,
    review: review
      ? {
          _id: String(review._id),
          status: review.verificationStatus,
          amount: review.amount,
          date: review.date,
          method: review.method,
          transactionRef: review.transactionRef ?? "",
          submittedAt: review.submittedAt ?? review.createdAt,
          rejectionReason: review.rejectionReason ?? "",
        }
      : null,
  };
}

export async function submitParentReceipt(ctx: TenantContext, feeId: string, form: FormData) {
  if (!isParentLike(ctx.session.roleSlugs) || ctx.impersonating) {
    throw new ApiError(403, "Only parents can upload payment receipts.");
  }
  const fee = await loadVisibleStudentFee(ctx, feeId);
  const dueAmount = outstandingAmount(fee);
  if (dueAmount <= 0 || fee.status === "PAID") {
    throw new ApiError(400, "This fee is already paid.");
  }

  const pending = await FeePayment.findOne({
    workspaceId: oid(ctx.workspaceId),
    studentFeeId: fee._id,
    verificationStatus: "PENDING_VERIFICATION",
  }).select("_id").lean();
  if (pending) {
    throw new ApiError(409, "A payment receipt is already under review for this fee.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    throw new ApiError(400, "Choose a receipt file to upload.");
  }

  const parsed = receiptUploadSchema.parse({
    amount: Number(form.get("amount")),
    date: String(form.get("date") ?? ""),
    method: String(form.get("method") ?? ""),
    transactionRef: String(form.get("transactionRef") ?? ""),
  });
  if (parsed.amount - dueAmount > 0.0001) {
    throw new ApiError(400, `Amount cannot exceed the outstanding due of ${dueAmount}.`);
  }

  let receiptFile: { name: string; url: string; size: number; mime: string };
  try {
    receiptFile = await saveFeeReceiptFile(ctx.workspaceId, String(fee._id), file);
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Upload failed");
  }

  const created = await FeePayment.create({
    workspaceId: oid(ctx.workspaceId),
    studentId: fee.studentId,
    studentFeeId: fee._id,
    amount: roundMoney(parsed.amount),
    method: parsed.method,
    receiptNumber: await nextReceiptNumber(ctx.workspaceId, "PV"),
    date: parsed.date,
    remarks: "Parent uploaded payment receipt",
    verificationStatus: "PENDING_VERIFICATION",
    source: "PARENT_RECEIPT",
    transactionRef: parsed.transactionRef,
    receiptFile,
    submittedBy: oid(ctx.session.sub),
    submittedByName: ctx.session.name ?? "",
    submittedAt: new Date(),
    appliedToFee: false,
  });

  return { item: created };
}

async function applyConfirmedPaymentToFee(
  workspaceId: string,
  payment: {
    _id: unknown;
    studentFeeId?: unknown;
    amount: number;
    appliedToFee?: boolean;
  },
) {
  if (payment.appliedToFee) {
    throw new ApiError(409, "This payment has already been applied.");
  }
  const feeId = payment.studentFeeId ? String(payment.studentFeeId) : "";
  if (!feeId || !mongoose.isValidObjectId(feeId)) {
    throw new ApiError(400, "This payment is not linked to a student fee.");
  }
  const fee = await StudentFee.findOne(scopedQuery(workspaceId, { _id: feeId }));
  if (!fee) throw new ApiError(404, "Linked fee was not found.");

  const due = outstandingAmount(fee);
  if (Number(payment.amount) - due > 0.0001) {
    throw new ApiError(400, `Payment exceeds the outstanding due of ${due}.`);
  }

  const nextPaid = roundMoney(Number(fee.paidAmount ?? 0) + Number(payment.amount));
  const nextStatus = statusFromPaid(Number(fee.amount), nextPaid);
  const updated = await StudentFee.findOneAndUpdate(
    {
      _id: fee._id,
      workspaceId: oid(workspaceId),
      paidAmount: fee.paidAmount ?? 0,
    },
    { $set: { paidAmount: nextPaid, status: nextStatus } },
    { new: true },
  );
  if (!updated) {
    throw new ApiError(409, "Fee was updated by another payment. Refresh and try again.");
  }
  return updated;
}

export async function applyAdminPaymentToFee(workspaceId: string, paymentId: string, studentFeeId?: unknown) {
  const payment = await FeePayment.findOne(scopedQuery(workspaceId, { _id: paymentId }));
  if (!payment) return;
  if (studentFeeId) payment.studentFeeId = oid(String(studentFeeId));
  if (!payment.studentFeeId) return;
  if (payment.verificationStatus && payment.verificationStatus !== "CONFIRMED") return;
  if (payment.appliedToFee) return;
  try {
    await applyConfirmedPaymentToFee(workspaceId, {
      _id: payment._id,
      studentFeeId: payment.studentFeeId,
      amount: Number(payment.amount),
      appliedToFee: payment.appliedToFee,
    });
    payment.appliedToFee = true;
    payment.verificationStatus = "CONFIRMED";
    payment.source = payment.source || "ADMIN";
    await payment.save();
  } catch {
    // Leave the payment recorded even if it cannot be applied to a specific fee.
  }
}

export async function verifyParentPayment(
  ctx: TenantContext,
  paymentId: string,
  action: "approve" | "reject",
  reason = "",
) {
  if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    throw new ApiError(403, "Parents cannot verify payments.");
  }
  if (!ctx.impersonating && !hasPermission(ctx.permissions, "fees.collect")) {
    throw new ApiError(403, "You do not have permission to verify payments.");
  }
  if (!mongoose.isValidObjectId(paymentId)) {
    throw new ApiError(400, "Invalid payment.");
  }

  if (action === "reject") {
    const rejectionReason = reason.trim();
    if (!rejectionReason) {
      throw new ApiError(400, "Enter a reason for rejecting this receipt.");
    }
    const rejected = await FeePayment.findOneAndUpdate(
      scopedQuery(ctx.workspaceId, {
        _id: paymentId,
        verificationStatus: "PENDING_VERIFICATION",
        appliedToFee: { $ne: true },
      }),
      {
        $set: {
          verificationStatus: "REJECTED",
          rejectionReason,
          verifiedBy: oid(ctx.session.sub),
          verifiedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!rejected) {
      throw new ApiError(409, "This payment is not waiting for verification.");
    }
    return { item: rejected, action: "reject" as const };
  }

  const locked = await FeePayment.findOneAndUpdate(
    scopedQuery(ctx.workspaceId, {
      _id: paymentId,
      verificationStatus: "PENDING_VERIFICATION",
      appliedToFee: { $ne: true },
    }),
    { $set: { appliedToFee: true } },
    { new: true },
  );
  if (!locked) {
    throw new ApiError(409, "This payment is not waiting for verification or was already processed.");
  }

  try {
    const fee = await applyConfirmedPaymentToFee(ctx.workspaceId, {
      _id: locked._id,
      studentFeeId: locked.studentFeeId,
      amount: Number(locked.amount),
      appliedToFee: false,
    });
    locked.verificationStatus = "CONFIRMED";
    locked.verifiedBy = oid(ctx.session.sub);
    locked.verifiedAt = new Date();
    locked.rejectionReason = "";
    await locked.save();
    return { item: locked, fee, action: "approve" as const };
  } catch (error) {
    locked.appliedToFee = false;
    await locked.save();
    throw error;
  }
}

export async function paymentVerificationDetail(ctx: TenantContext, paymentId: string) {
  if (!mongoose.isValidObjectId(paymentId)) {
    throw new ApiError(400, "Invalid payment.");
  }
  const payment = await FeePayment.findOne(scopedQuery(ctx.workspaceId, { _id: paymentId })).lean();
  if (!payment) throw new ApiError(404, "Payment not found.");

  if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    await assertPortalCanViewStudent(ctx, String(payment.studentId));
  } else if (!hasPermission(ctx.permissions, "payments.view") && !ctx.impersonating) {
    throw new ApiError(403, "Permission denied.");
  }

  const student = await Student.findOne(scopedQuery(ctx.workspaceId, { _id: payment.studentId }))
    .select("name admissionNumber classId sectionId")
    .lean();
  const [classDoc, sectionDoc, fee] = await Promise.all([
    student?.classId
      ? SchoolClass.findOne(scopedQuery(ctx.workspaceId, { _id: student.classId })).select("name").lean()
      : null,
    student?.sectionId
      ? Section.findOne(scopedQuery(ctx.workspaceId, { _id: student.sectionId })).select("name").lean()
      : null,
    payment.studentFeeId
      ? StudentFee.findOne(scopedQuery(ctx.workspaceId, { _id: payment.studentFeeId }))
          .select("description amount paidAmount status feeStructureId")
          .lean()
      : null,
  ]);
  const structure = fee?.feeStructureId
    ? await FeeStructure.findOne(scopedQuery(ctx.workspaceId, { _id: fee.feeStructureId })).select("name").lean()
    : null;

  return {
    item: {
      ...payment,
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? "",
      className: classDoc?.name ?? "",
      sectionName: sectionDoc?.name ?? "",
      feeHead: structure?.name || fee?.description || "",
      feeAmount: fee?.amount,
      feePaidAmount: fee?.paidAmount,
      feeStatus: fee?.status,
    },
  };
}
