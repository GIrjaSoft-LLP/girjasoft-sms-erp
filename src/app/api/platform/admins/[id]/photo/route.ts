import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, json, requirePlatformPerm, requirePlatformSession } from "@/lib/api/guards";
import { isUploadedFile, readProfilePhoto, removeProfilePhoto, saveProfilePhoto } from "@/lib/profile-photo";
import { PlatformAdmin } from "@/models/platform";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    await requirePlatformSession();
    const { id } = await ctx.params;
    const file = await readProfilePhoto("platform", "platform", id);
    if (!file) return new NextResponse(null, { status: 404 });
    const bytes = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
    return new NextResponse(bytes, {
      headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requirePlatformSession();
    const { id } = await ctx.params;
    const canSelf = session.sub === id;
    if (!canSelf && !session.permissions.includes("platform.users.edit")) {
      throw new ApiError(403, "Forbidden.");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) throw new ApiError(400, "Choose a photo to upload.");
    const photo = await saveProfilePhoto("platform", "platform", id, file);
    await PlatformAdmin.updateOne({ _id: id }, { $set: { photo } });
    return json({ photoUrl: `/api/platform/admins/${id}/photo?v=${Date.now()}` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const session = await requirePlatformSession();
    const { id } = await ctx.params;
    const canSelf = session.sub === id;
    if (!canSelf && !session.permissions.includes("platform.users.edit")) {
      throw new ApiError(403, "Forbidden.");
    }
    await removeProfilePhoto("platform", "platform", id);
    await PlatformAdmin.updateOne({ _id: id }, { $set: { photo: "" } });
    return json({ photo: "" });
  } catch (error) {
    return errorResponse(error);
  }
}
