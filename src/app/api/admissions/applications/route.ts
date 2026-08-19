import mongoose from "mongoose";
import { z } from "zod";
import { ApiError, errorResponse, json, scopedQuery } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { pushWorkflowEvent } from "@/lib/admissions/audit";
import { findAdmissionDuplicates } from "@/lib/admissions/duplicates";
import { computeFeeTotals, generateApplicationNumber } from "@/lib/admissions/numbers";
import { buildDocumentChecklist, getAdmissionSettings } from "@/lib/admissions/settings";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication } from "@/models/admissions";

const createSchema = z.object({
  type: z.enum(["APPLICATION", "DIRECT"]).default("APPLICATION"),
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
  duplicateWarningAcknowledged: z.boolean().optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
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
        { applicationNumber: { $regex: q, $options: "i" } },
        { "student.name": { $regex: q, $options: "i" } },
        { "father.mobile": { $regex: q, $options: "i" } },
        { "mother.mobile": { $regex: q, $options: "i" } },
        { admissionNumber: { $regex: q, $options: "i" } },
      ];
    }
    const items = await AdmissionApplication.find(query).sort({ createdAt: -1 }).limit(300).lean();
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.create");
    const body = createSchema.parse(await request.json());
    const settings = await getAdmissionSettings(ctx.workspaceId);
    const student = body.student ?? {};
    const father = body.father ?? {};
    const mother = body.mother ?? {};
    const duplicates = await findAdmissionDuplicates(ctx.workspaceId, {
      mobile: father.mobile || mother.mobile,
      email: father.email || mother.email,
      aadhaar: student.aadhaar,
      studentName: student.name,
      dateOfBirth: student.dateOfBirth,
    });
    if (duplicates.length && !body.duplicateWarningAcknowledged) {
      return json({ duplicates, requiresAcknowledgement: true });
    }
    const applicationNumber = await generateApplicationNumber(ctx.workspaceId, body.academicSessionId);
    const fees = computeFeeTotals(settings.feeHeads);
    const status = body.status ?? "DRAFT";
    const application = await AdmissionApplication.create({
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      applicationNumber,
      type: body.type,
      status,
      academicSessionId: body.academicSessionId || null,
      applyingClassId: body.applyingClassId || null,
      applyingSectionId: body.applyingSectionId || null,
      student,
      father,
      mother,
      permanentAddress: body.permanentAddress ?? {},
      currentAddress: body.currentAddress ?? {},
      sameAsPermanent: body.sameAsPermanent ?? false,
      previousSchoolInfo: body.previousSchoolInfo ?? {},
      source: body.source ?? "",
      remarks: body.remarks ?? "",
      assignedStaffId: body.assignedStaffId ?? "",
      assignedStaffName: body.assignedStaffName ?? "",
      preferredAdmissionDate: body.preferredAdmissionDate ?? "",
      applicationDate: new Date().toISOString().slice(0, 10),
      duplicateWarningAcknowledged: body.duplicateWarningAcknowledged ?? false,
      linkedDuplicateIds: duplicates.map((d) => d.id),
      documents: buildDocumentChecklist(settings),
      fees: { ...settings.feeHeads, ...fees },
      workflowHistory: [
        {
          action: body.type === "DIRECT" ? "DIRECT_ADMISSION_CREATED" : "APPLICATION_CREATED",
          status,
          userId: ctx.session.sub,
          userEmail: ctx.session.email,
          at: new Date(),
        },
      ],
    });
    if (status === "SUBMITTED") {
      pushWorkflowEvent(application, ctx.session, "SUBMITTED", "SUBMITTED", "Application submitted");
      await application.save();
    }
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_APPLICATION_CREATED", "admissions", String(application._id));
    return json({ item: application, duplicates }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
