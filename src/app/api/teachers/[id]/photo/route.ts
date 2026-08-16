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
import { assertCanManageTeacherPhoto } from "@/lib/id-card-access";
import {
  isUploadedFile,
  readProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto,
} from "@/lib/profile-photo";
import { Teacher } from "@/models/workspace";

type Ctx = { params: Promise<{ id: string }> };

async function loadTeacher(id: string, workspaceId: string) {
  const teacher = await Teacher.findById(id);
  if (!teacher) throw new ApiError(404, "Teacher not found.");
  assertSameWorkspace(teacher.workspaceId, workspaceId);
  return teacher;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tenant = await requireWorkspaceContext();
    const teacher = await loadTeacher(id, tenant.workspaceId);
    const visible = applyRecordVisibility(tenant, "teachers", scopedQuery(tenant.workspaceId, { _id: teacher._id }));
    const allowed = await Teacher.findOne(visible).select("_id").lean();
    if (!allowed) throw new ApiError(403, "Forbidden.");
    const file = await readProfilePhoto(tenant.workspaceId, "teachers", id);
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
    await loadTeacher(id, tenant.workspaceId);
    assertCanManageTeacherPhoto(tenant, id);
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) throw new ApiError(400, "Choose a photo to upload.");
    let photo: string;
    try {
      photo = await saveProfilePhoto(tenant.workspaceId, "teachers", id, file);
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Upload failed");
    }
    await Teacher.updateOne(scopedQuery(tenant.workspaceId, { _id: id }), { $set: { photo } });
    return json({ photo, photoUrl: `/api/teachers/${id}/photo?v=${Date.now()}` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tenant = await requireWorkspaceContext();
    await loadTeacher(id, tenant.workspaceId);
    assertCanManageTeacherPhoto(tenant, id);
    await removeProfilePhoto(tenant.workspaceId, "teachers", id);
    await Teacher.updateOne(scopedQuery(tenant.workspaceId, { _id: id }), { $set: { photo: "" } });
    return json({ photo: "" });
  } catch (error) {
    return errorResponse(error);
  }
}
