import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, json, requirePlatformSession } from "@/lib/api/guards";
import { isUploadedFile, readProfilePhoto, removeProfilePhoto, saveProfilePhoto } from "@/lib/profile-photo";
import { PlatformAdmin } from "@/models/platform";

export async function GET() {
  try {
    const session = await requirePlatformSession();
    const file = await readProfilePhoto("platform", "platform", session.sub);
    if (!file) return new NextResponse(null, { status: 404 });
    const bytes = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
    return new NextResponse(bytes, {
      headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformSession();
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) throw new ApiError(400, "Choose a photo to upload.");
    const photo = await saveProfilePhoto("platform", "platform", session.sub, file);
    await PlatformAdmin.updateOne({ _id: session.sub }, { $set: { photo } });
    return json({ photo, photoUrl: `/api/platform/profile/photo?v=${Date.now()}` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const session = await requirePlatformSession();
    await removeProfilePhoto("platform", "platform", session.sub);
    await PlatformAdmin.updateOne({ _id: session.sub }, { $set: { photo: "" } });
    return json({ photo: "" });
  } catch (error) {
    return errorResponse(error);
  }
}
