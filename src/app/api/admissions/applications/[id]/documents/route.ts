import { ApiError, errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { pushWorkflowEvent } from "@/lib/admissions/audit";
import { saveAdmissionDocument } from "@/lib/admissions/files";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication } from "@/models/admissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const { id } = await params;
    const form = await request.formData();
    const key = String(form.get("key") ?? "").trim();
    const file = form.get("file");
    if (!key) throw new ApiError(400, "Document key is required.");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose a file to upload.");

    const application = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId });
    if (!application) throw new ApiError(404, "Application not found.");
    const docIndex = application.documents.findIndex((d: { key: string }) => d.key === key);
    if (docIndex === -1) throw new ApiError(404, "Document type not found.");

    const saved = await saveAdmissionDocument(ctx.workspaceId, id, file);
    application.documents[docIndex].url = saved.url;
    application.documents[docIndex].mime = saved.mime;
    application.documents[docIndex].size = saved.size;
    application.documents[docIndex].status = "UPLOADED";
    application.documents[docIndex].verifiedBy = "";
    application.documents[docIndex].verifiedAt = null;
    application.documents[docIndex].remarks = "";

    if (application.status === "DOCUMENTS_PENDING") {
      const pendingMandatory = application.documents.some(
        (d: { mandatory?: boolean; status?: string }) => d.mandatory && d.status !== "VERIFIED" && d.status !== "UPLOADED",
      );
      if (!pendingMandatory) {
        pushWorkflowEvent(application, ctx.session, "DOCUMENTS_UPLOADED", "UNDER_REVIEW", "All mandatory documents uploaded");
      }
    }
    await application.save();
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_DOCUMENT_UPLOADED", "admissions", id, { key });
    return json({ item: application });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.verify");
    const { id } = await params;
    const body = (await request.json()) as { key: string; status: string; remarks?: string };
    if (!body.key || !body.status) throw new ApiError(400, "Document key and status are required.");

    const application = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId });
    if (!application) throw new ApiError(404, "Application not found.");
    const doc = application.documents.find((d: { key: string }) => d.key === body.key);
    if (!doc) throw new ApiError(404, "Document not found.");

    doc.status = body.status;
    doc.remarks = body.remarks ?? "";
    if (body.status === "VERIFIED" || body.status === "REJECTED") {
      doc.verifiedBy = ctx.session.email ?? ctx.session.sub;
      doc.verifiedAt = new Date();
    }

    const allMandatoryVerified = application.documents
      .filter((d: { mandatory?: boolean }) => d.mandatory)
      .every((d: { status?: string }) => d.status === "VERIFIED");
    if (allMandatoryVerified && ["UNDER_REVIEW", "DOCUMENTS_PENDING", "SUBMITTED"].includes(application.status)) {
      pushWorkflowEvent(application, ctx.session, "DOCUMENTS_VERIFIED", "DOCUMENTS_VERIFIED", "Mandatory documents verified");
    } else if (body.status === "REJECTED" && application.status !== "DOCUMENTS_PENDING") {
      pushWorkflowEvent(application, ctx.session, "DOCUMENT_REJECTED", "DOCUMENTS_PENDING", body.remarks ?? "Document rejected");
    }

    await application.save();
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_DOCUMENT_VERIFIED", "admissions", id, body);
    return json({ item: application });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const { id } = await params;
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) throw new ApiError(400, "Document key is required.");

    const application = await AdmissionApplication.findOne({ _id: id, workspaceId: ctx.workspaceId });
    if (!application) throw new ApiError(404, "Application not found.");
    const doc = application.documents.find((d: { key: string }) => d.key === key);
    if (!doc) throw new ApiError(404, "Document not found.");
    doc.url = "";
    doc.mime = "";
    doc.size = 0;
    doc.status = "PENDING";
    doc.verifiedBy = "";
    doc.verifiedAt = null;
    doc.remarks = "";
    await application.save();
    return json({ item: application });
  } catch (error) {
    return errorResponse(error);
  }
}
