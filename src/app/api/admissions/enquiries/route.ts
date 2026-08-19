import mongoose from "mongoose";
import { z } from "zod";
import { ApiError, errorResponse, json, scopedQuery } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { findAdmissionDuplicates } from "@/lib/admissions/duplicates";
import { generateEnquiryNumber, generateApplicationNumber, computeFeeTotals } from "@/lib/admissions/numbers";
import { buildDocumentChecklist, getAdmissionSettings } from "@/lib/admissions/settings";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication, AdmissionEnquiry } from "@/models/admissions";

const enquirySchema = z.object({
  studentName: z.string().min(2),
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

export async function GET(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();
    const query: Record<string, unknown> = { ...scopedQuery(ctx.workspaceId) };
    if (status) query.status = status;
    if (q) {
      query.$or = [
        { studentName: { $regex: q, $options: "i" } },
        { parentName: { $regex: q, $options: "i" } },
        { parentMobile: { $regex: q, $options: "i" } },
        { enquiryNumber: { $regex: q, $options: "i" } },
      ];
    }
    const items = await AdmissionEnquiry.find(query).sort({ createdAt: -1 }).limit(200).lean();
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.create");
    const body = enquirySchema.parse(await request.json());
    const duplicates = await findAdmissionDuplicates(ctx.workspaceId, {
      mobile: body.parentMobile,
      email: body.parentEmail,
      studentName: body.studentName,
      dateOfBirth: body.dateOfBirth,
    });
    const enquiryNumber = await generateEnquiryNumber(ctx.workspaceId, body.academicSessionId);
    const item = await AdmissionEnquiry.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      enquiryNumber,
      ...body,
      enquiryDate: body.enquiryDate || new Date().toISOString().slice(0, 10),
      status: body.status || "NEW",
    });
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_ENQUIRY_CREATED", "admissions", String(item._id));
    return json({ item, duplicates }, duplicates.length ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.convert");
    const body = z.object({ enquiryId: z.string() }).parse(await request.json());
    const enquiry = await AdmissionEnquiry.findOne({ _id: body.enquiryId, workspaceId: ctx.workspaceId });
    if (!enquiry) throw new ApiError(404, "Enquiry not found.");
    if (enquiry.applicationId) throw new ApiError(409, "Enquiry already converted.");
    const settings = await getAdmissionSettings(ctx.workspaceId);
    const applicationNumber = await generateApplicationNumber(ctx.workspaceId, enquiry.academicSessionId);
    const fees = computeFeeTotals(settings.feeHeads);
    const application = await AdmissionApplication.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      applicationNumber,
      enquiryId: enquiry._id,
      type: "APPLICATION",
      status: "DRAFT",
      academicSessionId: enquiry.academicSessionId,
      applyingClassId: enquiry.applyingClassId,
      student: {
        name: enquiry.studentName,
        dateOfBirth: enquiry.dateOfBirth,
        gender: enquiry.gender,
      },
      father: { name: enquiry.parentName, mobile: enquiry.parentMobile, email: enquiry.parentEmail },
      source: enquiry.source,
      remarks: enquiry.remarks,
      preferredAdmissionDate: enquiry.preferredAdmissionDate,
      applicationDate: new Date().toISOString().slice(0, 10),
      assignedStaffId: enquiry.assignedStaffId,
      assignedStaffName: enquiry.assignedStaffName,
      documents: buildDocumentChecklist(settings),
      fees: { ...settings.feeHeads, ...fees },
      workflowHistory: [
        {
          action: "CREATED_FROM_ENQUIRY",
          status: "DRAFT",
          userId: ctx.session.sub,
          userEmail: ctx.session.email,
          remarks: enquiry.enquiryNumber,
          at: new Date(),
        },
      ],
    });
    enquiry.status = "APPLICATION_STARTED";
    enquiry.applicationId = application._id as mongoose.Types.ObjectId;
    await enquiry.save();
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_ENQUIRY_CONVERTED", "admissions", String(enquiry._id), {
      applicationId: String(application._id),
    });
    return json({ item: application, enquiry }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
