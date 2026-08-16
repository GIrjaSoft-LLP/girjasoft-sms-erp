import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  applyRecordVisibility,
  assertSameWorkspace,
  errorResponse,
  json,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { assertCanManageStudentPhoto } from "@/lib/id-card-access";
import {
  isUploadedFile,
  readProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto,
} from "@/lib/profile-photo";
import { Student } from "@/models/workspace";

type Ctx = { params: Promise<{ id: string }> };

async function loadStudent(id: string, workspaceId: string) {
  const student = await Student.findById(id);
  if (!student) throw new ApiError(404, "Student not found.");
  assertSameWorkspace(student.workspaceId, workspaceId);
  return student;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tenant = await requireWorkspaceContext();
    const student = await loadStudent(id, tenant.workspaceId);
    const visible = applyRecordVisibility(tenant, "students", scopedQuery(tenant.workspaceId, { _id: student._id }));
    const allowed = await Student.findOne(visible).select("_id").lean();
    if (!allowed) throw new ApiError(403, "Forbidden.");
    const file = await readProfilePhoto(tenant.workspaceId, "students", id);
    if (!file) return new NextResponse(null, { status: 404 });
    const bytes = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tenant = await requireWorkspaceContext();
    await loadStudent(id, tenant.workspaceId);
    assertCanManageStudentPhoto(tenant, id);
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) throw new ApiError(400, "Choose a photo to upload.");
    let photo: string;
    try {
      photo = await saveProfilePhoto(tenant.workspaceId, "students", id, file);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Upload failed");
    }
    await Student.updateOne(scopedQuery(tenant.workspaceId, { _id: id }), { $set: { photo } });
    return json({ photo, photoUrl: `/api/students/${id}/photo?v=${Date.now()}` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tenant = await requireWorkspaceContext();
    await loadStudent(id, tenant.workspaceId);
    assertCanManageStudentPhoto(tenant, id);
    await removeProfilePhoto(tenant.workspaceId, "students", id);
    await Student.updateOne(scopedQuery(tenant.workspaceId, { _id: id }), { $set: { photo: "" } });
    return json({ photo: "" });
  } catch (error) {
    return errorResponse(error);
  }
}
