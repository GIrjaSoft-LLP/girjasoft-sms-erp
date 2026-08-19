import { z } from "zod";
import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionFollowUp } from "@/models/admissions";

const patchSchema = z.object({
  followUpDate: z.string().optional(),
  followUpTime: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  status: z.string().optional(),
  assignedStaffId: z.string().optional(),
  assignedStaffName: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const item = await AdmissionFollowUp.findOneAndUpdate(
      { _id: id, workspaceId: ctx.workspaceId },
      { $set: body },
      { new: true },
    );
    if (!item) throw new ApiError(404, "Follow-up not found.");
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_FOLLOWUP_UPDATED", "admissions", id);
    return json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
