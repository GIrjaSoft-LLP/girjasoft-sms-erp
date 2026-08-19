import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { SchoolClass, Subject } from "@/models/workspace";

const SUBJECT_CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/;

export async function applySubjectPayload(
  workspaceId: string,
  body: Record<string, unknown>,
  existingSubjectId?: string | null,
) {
  const classId = String(body.classId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  const classOrderRaw = body.classOrder;

  if (!classId || !mongoose.isValidObjectId(classId)) {
    throw new ApiError(400, "Class is required.");
  }
  if (!name) {
    throw new ApiError(400, "Subject Name is required.");
  }
  if (!code) {
    throw new ApiError(400, "Subject Code is required.");
  }
  if (!SUBJECT_CODE_PATTERN.test(code)) {
    throw new ApiError(400, "Subject Code must be 2–20 characters using letters, numbers, hyphen or underscore.");
  }
  if (classOrderRaw === "" || classOrderRaw == null || !Number.isFinite(Number(classOrderRaw))) {
    throw new ApiError(400, "Class Order is required and must be numeric.");
  }
  const classOrder = Number(classOrderRaw);

  const classDoc = await SchoolClass.findOne({ _id: classId, workspaceId });
  if (!classDoc) {
    throw new ApiError(400, "Selected class is invalid.");
  }

  const duplicateCodeQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    classId: new mongoose.Types.ObjectId(classId),
    code,
  };
  const duplicateNameQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    classId: new mongoose.Types.ObjectId(classId),
    name,
  };
  if (existingSubjectId) {
    const exclude = new mongoose.Types.ObjectId(existingSubjectId);
    duplicateCodeQuery._id = { $ne: exclude };
    duplicateNameQuery._id = { $ne: exclude };
  }

  const [duplicateCode, duplicateName] = await Promise.all([
    Subject.findOne(duplicateCodeQuery),
    Subject.findOne(duplicateNameQuery),
  ]);
  if (duplicateCode) {
    throw new ApiError(409, "A subject with this code already exists for the selected class.");
  }
  if (duplicateName) {
    throw new ApiError(409, "A subject with this name already exists for the selected class.");
  }

  classDoc.numericName = classOrder;
  await classDoc.save();

  delete body.classOrder;
  body.classId = new mongoose.Types.ObjectId(classId);
  body.name = name;
  body.code = code;

  return body;
}
