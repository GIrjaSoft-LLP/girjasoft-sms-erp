import { z } from "zod";
import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionEnquiry } from "@/models/admissions";

const patchSchema = z.object({
  studentName: z.string().min(2).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  applyingClassId: z.string().optional(),
  academicSessionId: z.string().optional(),
  parentName: z.string().optional(),
  parentMobile: z.string().optional(),
  parentEmail: z.string().optional(),
  enquiryDate: z.string().optional(),
  source: z.string().optional(),
  preferredAdmissionDate: z.string().optional(),
  remarks: z.string().optional(),
  assignedStaffId: z.string().optional(),
  assignedStaffName: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpRemarks: z.string().optional(),
  status: z.string().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const { id } = await params;
    const item = await AdmissionEnquiry.findOne({ _id: id, workspaceId: ctx.workspaceId }).lean();
    if (!item) throw new ApiError(404, "Enquiry not found.");
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
    const item = await AdmissionEnquiry.findOneAndUpdate(
      { _id: id, workspaceId: ctx.workspaceId },
      { $set: body },
      { new: true },
    );
    if (!item) throw new ApiError(404, "Enquiry not found.");
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_ENQUIRY_UPDATED", "admissions", id);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.delete");
    const { id } = await params;
    const item = await AdmissionEnquiry.findOneAndUpdate(
      { _id: id, workspaceId: ctx.workspaceId },
      { $set: { status: "CLOSED" } },
      { new: true },
    );
    if (!item) throw new ApiError(404, "Enquiry not found.");
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_ENQUIRY_CLOSED", "admissions", id);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
