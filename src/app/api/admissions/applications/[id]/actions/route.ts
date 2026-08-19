import { z } from "zod";
import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { pushWorkflowEvent } from "@/lib/admissions/audit";
import { convertApplicationToStudent } from "@/lib/admissions/convert";
import { generateAdmissionNumber, computeFeeTotals } from "@/lib/admissions/numbers";
import { getAdmissionSettings } from "@/lib/admissions/settings";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication } from "@/models/admissions";

const actionSchema = z.object({
  action: z.enum([
    "submit",
    "approve",
    "reject",
    "payment",
    "confirm",
    "convert",
    "cancel",
    "refund",
    "discount",
  ]),
  remarks: z.string().optional(),
  amount: z.number().optional(),
  method: z.string().optional(),
  receiptNumber: z.string().optional(),
  discount: z
    .object({
      name: z.string(),
      discountType: z.enum(["PERCENTAGE", "FIXED"]),
      percentage: z.number().optional(),
      amount: z.number().optional(),
      eligibility: z.string().optional(),
    })
    .optional(),
  cancellation: z
    .object({
      reason: z.string(),
      refundAmount: z.number().optional(),
      deduction: z.number().optional(),
      netRefund: z.number().optional(),
      refundStatus: z.string().optional(),
      remarks: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const application = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId });
    if (!application) throw new ApiError(404, "Application not found.");
    const settings = await getAdmissionSettings(ctx.workspaceId);

    switch (body.action) {
      case "submit": {
        if (!["DRAFT", "DOCUMENTS_PENDING"].includes(application.status)) {
          throw new ApiError(400, "Application cannot be submitted in its current status.");
        }
        pushWorkflowEvent(application, ctx.session, "SUBMITTED", "SUBMITTED", body.remarks ?? "Application submitted");
        break;
      }
      case "approve": {
        await requireAdmissionContext("admissions.approve");
        if (settings.requireDocumentVerification) {
          const pending = application.documents.some(
            (d: { mandatory?: boolean; status?: string }) => d.mandatory && d.status !== "VERIFIED",
          );
          if (pending) throw new ApiError(400, "Mandatory documents must be verified before approval.");
        }
        const admissionNumber =
          application.admissionNumber ||
          (await generateAdmissionNumber(ctx.workspaceId, application.academicSessionId));
        application.admissionNumber = admissionNumber;
        pushWorkflowEvent(application, ctx.session, "APPROVED", "APPROVED", body.remarks ?? "Admission approved");
        if (Number(application.fees?.due ?? 0) > 0) {
          pushWorkflowEvent(application, ctx.session, "PAYMENT_REQUIRED", "PAYMENT_PENDING", "Awaiting payment");
        }
        break;
      }
      case "reject": {
        await requireAdmissionContext("admissions.approve");
        pushWorkflowEvent(application, ctx.session, "REJECTED", "REJECTED", body.remarks ?? "Application rejected");
        break;
      }
      case "payment": {
        await requireAdmissionContext("admissions.collect");
        const amount = Number(body.amount ?? 0);
        if (amount <= 0) throw new ApiError(400, "Enter a valid payment amount.");
        application.paymentRecords.push({
          amount,
          method: body.method ?? "CASH",
          receiptNumber: body.receiptNumber ?? `ADM-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          remarks: body.remarks ?? "",
          feeType: "ADMISSION",
        });
        const paid = (application.paymentRecords ?? []).reduce(
          (sum: number, row: { amount?: number }) => sum + Number(row.amount ?? 0),
          0,
        );
        const feeTotals = computeFeeTotals({ ...application.fees, paid });
        application.fees = { ...application.fees, ...feeTotals } as never;
        if (Number(application.fees.due) <= 0 && application.status === "PAYMENT_PENDING") {
          pushWorkflowEvent(application, ctx.session, "PAYMENT_RECEIVED", "APPROVED", "Full payment received");
        }
        break;
      }
      case "confirm": {
        await requireAdmissionContext("admissions.approve");
        if (settings.requirePaymentBeforeConfirm && Number(application.fees?.due ?? 0) > 0) {
          throw new ApiError(400, "Collect outstanding fees before confirming admission.");
        }
        if (!application.admissionNumber) {
          application.admissionNumber = await generateAdmissionNumber(
            ctx.workspaceId,
            application.academicSessionId,
          );
        }
        pushWorkflowEvent(application, ctx.session, "CONFIRMED", "CONFIRMED", body.remarks ?? "Admission confirmed");
        if (settings.autoCreateStudent && !application.convertedStudentId) {
          await application.save();
          const result = await convertApplicationToStudent(ctx.session, ctx.workspaceId, id);
          return json({ item: result.application, student: result.student, parentCredentials: result.parentCredentials });
        }
        break;
      }
      case "convert": {
        await requireAdmissionContext("admissions.convert");
        await application.save();
        const result = await convertApplicationToStudent(ctx.session, ctx.workspaceId, id);
        return json({ item: result.application, student: result.student, parentCredentials: result.parentCredentials });
      }
      case "cancel": {
        await requireAdmissionContext("admissions.cancel");
        const cancel = body.cancellation;
        if (!cancel?.reason) throw new ApiError(400, "Cancellation reason is required.");
        application.cancellation = {
          date: new Date().toISOString().slice(0, 10),
          reason: cancel.reason,
          refundAmount: Number(cancel.refundAmount ?? 0),
          deduction: Number(cancel.deduction ?? 0),
          netRefund: Number(cancel.netRefund ?? 0),
          refundStatus: cancel.refundStatus ?? "NOT_APPLICABLE",
          approvedBy: ctx.session.email ?? ctx.session.sub,
          approvalDate: new Date().toISOString().slice(0, 10),
          remarks: cancel.remarks ?? "",
        };
        pushWorkflowEvent(application, ctx.session, "CANCELLED", "CANCELLED", cancel.reason);
        break;
      }
      case "refund": {
        await requireAdmissionContext("admissions.refund");
        if (!application.cancellation?.reason) throw new ApiError(400, "Admission must be cancelled first.");
        application.cancellation.refundStatus = body.cancellation?.refundStatus ?? "PROCESSED";
        application.cancellation.netRefund = Number(
          body.cancellation?.netRefund ?? application.cancellation.netRefund ?? 0,
        );
        pushWorkflowEvent(
          application,
          ctx.session,
          "REFUND_PROCESSED",
          application.status,
          body.remarks ?? "Refund processed",
        );
        break;
      }
      case "discount": {
        await requireAdmissionContext("admissions.approve");
        if (!body.discount) throw new ApiError(400, "Discount details are required.");
        application.discounts.push({
          ...body.discount,
          status: "APPROVED",
          approvedBy: ctx.session.email ?? ctx.session.sub,
          approvedAt: new Date(),
        });
        let discountAmount = 0;
        const gross =
          Number(application.fees.registrationFee ?? 0) +
          Number(application.fees.applicationFee ?? 0) +
          Number(application.fees.admissionFee ?? 0) +
          Number(application.fees.securityDeposit ?? 0) +
          Number(application.fees.tuitionFee ?? 0) +
          Number(application.fees.transportFee ?? 0) +
          Number(application.fees.otherCharges ?? 0);
        if (body.discount.discountType === "PERCENTAGE") {
          discountAmount = Math.round((gross * Number(body.discount.percentage ?? 0)) / 100);
        } else {
          discountAmount = Number(body.discount.amount ?? 0);
        }
        const nextDiscount = Number(application.fees.discount ?? 0) + discountAmount;
        const feeTotals = computeFeeTotals({ ...application.fees, discount: nextDiscount });
        application.fees = { ...application.fees, ...feeTotals } as never;
        pushWorkflowEvent(application, ctx.session, "DISCOUNT_APPLIED", application.status, body.discount.name);
        break;
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }

    await application.save();
    await logWorkspace(ctx.session, ctx.workspaceId, `ADMISSION_${body.action.toUpperCase()}`, "admissions", id);
    return json({ item: application });
  } catch (error) {
    return errorResponse(error);
  }
}
