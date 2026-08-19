import { z } from "zod";
import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { pushWorkflowEvent } from "@/lib/admissions/audit";
import { computeFeeTotals } from "@/lib/admissions/numbers";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication } from "@/models/admissions";

const patchSchema = z.object({
  academicSessionId: z.string().optional(),
  applyingClassId: z.string().optional(),
  applyingSectionId: z.string().optional(),
  student: z.record(z.string(), z.string()).optional(),
  father: z.record(z.string(), z.string()).optional(),
  mother: z.record(z.string(), z.string()).optional(),
  permanentAddress: z.record(z.string(), z.string()).optional(),
  currentAddress: z.record(z.string(), z.string()).optional(),
  sameAsPermanent: z.boolean().optional(),
  previousSchoolInfo: z.record(z.string(), z.string()).optional(),
  source: z.string().optional(),
  remarks: z.string().optional(),
  assignedStaffId: z.string().optional(),
  assignedStaffName: z.string().optional(),
  preferredAdmissionDate: z.string().optional(),
  fees: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  discounts: z.array(z.record(z.string(), z.unknown())).optional(),
  status: z.string().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const { id } = await params;
    const item = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId }).lean();
    if (!item) throw new ApiError(404, "Application not found.");
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const application = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId });
    if (!application) throw new ApiError(404, "Application not found.");
    if (["CONFIRMED", "CANCELLED"].includes(application.status)) {
      throw new ApiError(400, "This application can no longer be edited.");
    }

    if (body.academicSessionId !== undefined) application.academicSessionId = body.academicSessionId as never;
    if (body.applyingClassId !== undefined) application.applyingClassId = body.applyingClassId as never;
    if (body.applyingSectionId !== undefined) application.applyingSectionId = body.applyingSectionId as never;
    if (body.student) application.student = { ...application.student, ...body.student };
    if (body.father) application.father = { ...application.father, ...body.father };
    if (body.mother) application.mother = { ...application.mother, ...body.mother };
    if (body.permanentAddress) application.permanentAddress = { ...application.permanentAddress, ...body.permanentAddress };
    if (body.currentAddress) application.currentAddress = { ...application.currentAddress, ...body.currentAddress };
    if (body.sameAsPermanent !== undefined) {
      application.sameAsPermanent = body.sameAsPermanent;
      if (body.sameAsPermanent) application.currentAddress = { ...application.permanentAddress };
    }
    if (body.previousSchoolInfo) {
      application.previousSchoolInfo = { ...application.previousSchoolInfo, ...body.previousSchoolInfo };
    }
    if (body.source !== undefined) application.source = body.source;
    if (body.remarks !== undefined) application.remarks = body.remarks;
    if (body.assignedStaffId !== undefined) application.assignedStaffId = body.assignedStaffId;
    if (body.assignedStaffName !== undefined) application.assignedStaffName = body.assignedStaffName;
    if (body.preferredAdmissionDate !== undefined) application.preferredAdmissionDate = body.preferredAdmissionDate;
    if (body.discounts) application.discounts = body.discounts as never;
    if (body.fees) {
      const merged = { ...application.fees, ...body.fees };
      application.fees = { ...merged, ...computeFeeTotals(merged) } as never;
    }
    if (body.status && body.status !== application.status) {
      pushWorkflowEvent(application, ctx.session, "STATUS_UPDATED", body.status, "Manual status update");
    }
    await application.save();
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_APPLICATION_UPDATED", "admissions", id);
    return json({ item: application });
  } catch (error) {
    return errorResponse(error);
  }
}
