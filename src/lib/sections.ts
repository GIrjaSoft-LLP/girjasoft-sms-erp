import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { SchoolClass, Section, Student } from "@/models/workspace";

export async function applySectionPayload(
  workspaceId: string,
  body: Record<string, unknown>,
  existingSectionId?: string | null,
) {
  const classId = String(body.classId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const capacity = Number(body.capacity);
  const classOrderRaw = body.classOrder;

  if (!classId || !mongoose.isValidObjectId(classId)) {
    throw new ApiError(400, "Class is required.");
  }
  if (!name) {
    throw new ApiError(400, "Section Name is required.");
  }
  if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
    throw new ApiError(400, "Capacity must be a positive whole number.");
  }
  if (classOrderRaw === "" || classOrderRaw == null || !Number.isFinite(Number(classOrderRaw))) {
    throw new ApiError(400, "Class Order is required and must be numeric.");
  }
  const classOrder = Number(classOrderRaw);

  const classDoc = await SchoolClass.findOne({ _id: classId, workspaceId });
  if (!classDoc) {
    throw new ApiError(400, "Selected class is invalid.");
  }

  if (existingSectionId) {
    const existing = await Section.findOne({ _id: existingSectionId, workspaceId });
    if (!existing) {
      throw new ApiError(404, "Section not found.");
    }
    if (String(existing.classId) !== classId) {
      const enrolled = await Student.countDocuments({ workspaceId, sectionId: existingSectionId });
      if (enrolled > 0) {
        throw new ApiError(400, "Cannot change class while students are assigned to this section.");
      }
    }
    const enrolled = await Student.countDocuments({ workspaceId, sectionId: existingSectionId });
    if (capacity < enrolled) {
      throw new ApiError(
        400,
        `Capacity cannot be less than the ${enrolled} student(s) already assigned to this section.`,
      );
    }
  }

  const duplicateQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    classId: new mongoose.Types.ObjectId(classId),
    name,
  };
  if (existingSectionId) {
    duplicateQuery._id = { $ne: new mongoose.Types.ObjectId(existingSectionId) };
  }
  const duplicate = await Section.findOne(duplicateQuery);
  if (duplicate) {
    throw new ApiError(409, "A section with this name already exists for the selected class.");
  }

  classDoc.numericName = classOrder;
  await classDoc.save();

  delete body.classOrder;
  body.classId = new mongoose.Types.ObjectId(classId);
  body.name = name;
  body.capacity = capacity;

  return body;
}

export async function assertSectionHasSeat(
  workspaceId: string,
  sectionId: unknown,
  excludeStudentId?: string,
) {
  if (!sectionId) return;
  const section = await Section.findOne({ _id: sectionId, workspaceId });
  if (!section) {
    throw new ApiError(400, "Invalid section.");
  }
  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    sectionId: section._id,
  };
  if (excludeStudentId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeStudentId) };
  }
  const count = await Student.countDocuments(query);
  if (count >= section.capacity) {
    throw new ApiError(400, `Section "${section.name}" is at full capacity (${section.capacity} students).`);
  }
}
