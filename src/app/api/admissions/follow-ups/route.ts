import mongoose from "mongoose";
import { z } from "zod";
import { errorResponse, json, scopedQuery } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionFollowUp } from "@/models/admissions";

const schema = z.object({
  enquiryId: z.string().optional(),
  applicationId: z.string().optional(),
  followUpDate: z.string(),
  followUpTime: z.string().optional(),
  applicantName: z.string().optional(),
  parentName: z.string().optional(),
  parentMobile: z.string().optional(),
  assignedStaffId: z.string().optional(),
  assignedStaffName: z.string().optional(),
  followUpType: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  status: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const query: Record<string, unknown> = { ...scopedQuery(ctx.workspaceId) };
    if (status) query.status = status;
    const items = await AdmissionFollowUp.find(query).sort({ followUpDate: 1 }).limit(200).lean();
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.create");
    const body = schema.parse(await request.json());
    const item = await AdmissionFollowUp.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      ...body,
      status: body.status ?? "PENDING",
    });
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_FOLLOWUP_CREATED", "admissions", String(item._id));
    return json({ item }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
