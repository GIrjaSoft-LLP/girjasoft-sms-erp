import mongoose from "mongoose";
import {
  ACADEMIC_EXCEL_HEADERS,
  ACADEMIC_EXCEL_SAMPLES,
  type AcademicExcelResource,
} from "@/config/excel-academic";
import { applySectionPayload } from "@/lib/sections";
import { applySubjectPayload } from "@/lib/subjects";
import { SchoolClass, Section, Subject } from "@/models/workspace";

export function normalizeClassName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeExcelKey(key: string) {
  return key.trim().replace(/\s+/g, "").replace(/_/g, "").toLowerCase();
}

export function getExcelCell(row: Record<string, string>, ...aliases: string[]) {
  const lookup = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeExcelKey(key), value]),
  );
  for (const alias of aliases) {
    const value = lookup[normalizeExcelKey(alias)];
    if (value !== undefined && value !== "") return String(value).trim();
  }
  return "";
}

type ClassLookup = {
  _id: mongoose.Types.ObjectId;
  name: string;
  numericName: number;
};

export async function buildClassLookupMap(workspaceId: string) {
  const classes = await SchoolClass.find({ workspaceId }).lean();
  const byName = new Map<string, ClassLookup>();
  const byId = new Map<string, ClassLookup>();
  for (const item of classes) {
    const entry: ClassLookup = {
      _id: item._id as mongoose.Types.ObjectId,
      name: item.name,
      numericName: Number(item.numericName ?? 0),
    };
    byName.set(normalizeClassName(item.name), entry);
    byId.set(String(item._id), entry);
  }
  return { byName, byId };
}

export function resolveClassFromRow(
  row: Record<string, string>,
  lookup: Awaited<ReturnType<typeof buildClassLookupMap>>,
) {
  const className = getExcelCell(row, "Class", "Class Name", "ClassName", "name");
  if (className) {
    const hit = lookup.byName.get(normalizeClassName(className));
    if (!hit) {
      throw new Error(
        `Class "${className}" was not found in this Workspace. Please create the Class first or correct the Class Name in the import file.`,
      );
    }
    return hit;
  }

  const legacyId = getExcelCell(row, "classId", "ClassId", "class_id", "_id", "id");
  if (legacyId && mongoose.isValidObjectId(legacyId)) {
    const hit = lookup.byId.get(legacyId);
    if (!hit) {
      throw new Error(`Class ID "${legacyId}" was not found in this Workspace.`);
    }
    return hit;
  }

  throw new Error("Class is required. Use the Class Name column in your import file.");
}

function parseClassOrder(row: Record<string, string>, fallback?: number) {
  const raw = getExcelCell(row, "Class Order", "ClassOrder", "numericName", "Order");
  if (!raw) {
    if (fallback != null) return fallback;
    throw new Error("Class Order is required and must be numeric.");
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("Class Order is required and must be numeric.");
  }
  return value;
}

export async function exportAcademicRows(resourceKey: AcademicExcelResource, workspaceId: string) {
  if (resourceKey === "classes") {
    const rows = await SchoolClass.find({ workspaceId }).sort({ numericName: 1, name: 1 }).lean();
    return rows.map((item) => ({
      "Class Name": item.name,
      "Class Order": item.numericName ?? 0,
    }));
  }

  if (resourceKey === "sections") {
    const rows = await Section.find({ workspaceId }).populate("classId", "name numericName").sort({ createdAt: -1 }).lean();
    return rows.map((item) => {
      const classRef = item.classId as { name?: string; numericName?: number } | null;
      return {
        Class: classRef?.name ?? "",
        "Class Order": classRef?.numericName ?? 0,
        "Section Name": item.name,
        Capacity: item.capacity ?? 0,
      };
    });
  }

  const rows = await Subject.find({ workspaceId }).populate("classId", "name numericName").sort({ createdAt: -1 }).lean();
  return rows.map((item) => {
    const classRef = item.classId as { name?: string; numericName?: number } | null;
    return {
      Class: classRef?.name ?? "",
      "Class Order": classRef?.numericName ?? 0,
      "Subject Name": item.name,
      "Subject Code": item.code,
    };
  });
}

export function academicHeaders(resourceKey: AcademicExcelResource) {
  return [...ACADEMIC_EXCEL_HEADERS[resourceKey]];
}

export function academicSampleRow(resourceKey: AcademicExcelResource) {
  return { ...ACADEMIC_EXCEL_SAMPLES[resourceKey] };
}

export async function importAcademicRow(
  resourceKey: AcademicExcelResource,
  workspaceId: string,
  row: Record<string, string>,
  lookup: Awaited<ReturnType<typeof buildClassLookupMap>>,
) {
  if (resourceKey === "classes") {
    const name = getExcelCell(row, "Class Name", "ClassName", "name");
    if (!name) throw new Error("Class Name is required.");
    const classOrder = parseClassOrder(row, 0);
    const normalized = normalizeClassName(name);
    const existing = [...lookup.byName.entries()].find(([key]) => key === normalized)?.[1];
    if (existing) {
      await SchoolClass.findByIdAndUpdate(existing._id, { $set: { numericName: classOrder } });
      existing.numericName = classOrder;
      return { action: "skipped" as const };
    }
    const created = await SchoolClass.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: name.trim().replace(/\s+/g, " "),
      numericName: classOrder,
      status: "ACTIVE",
    });
    lookup.byName.set(normalizeClassName(created.name), {
      _id: created._id as mongoose.Types.ObjectId,
      name: created.name,
      numericName: created.numericName ?? classOrder,
    });
    lookup.byId.set(String(created._id), lookup.byName.get(normalizeClassName(created.name))!);
    return { action: "created" as const };
  }

  const classRef = resolveClassFromRow(row, lookup);
  const classOrder = parseClassOrder(row, classRef.numericName);

  if (resourceKey === "sections") {
    const sectionName = getExcelCell(row, "Section Name", "SectionName", "name");
    const capacityRaw = getExcelCell(row, "Capacity", "capacity");
    if (!sectionName) throw new Error("Section Name is required.");
    if (!capacityRaw) throw new Error("Capacity is required.");
    const body: Record<string, unknown> = {
      classId: String(classRef._id),
      classOrder,
      name: sectionName,
      capacity: Number(capacityRaw),
    };
    const duplicate = await Section.findOne({
      workspaceId,
      classId: classRef._id,
      name: sectionName.trim(),
    });
    if (duplicate) {
      await applySectionPayload(workspaceId, body, String(duplicate._id));
      await Section.findByIdAndUpdate(duplicate._id, {
        $set: {
          classId: body.classId,
          name: body.name,
          capacity: body.capacity,
        },
      });
      return { action: "skipped" as const };
    }
    await applySectionPayload(workspaceId, body);
    await Section.create({
      ...body,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return { action: "created" as const };
  }

  const subjectName = getExcelCell(row, "Subject Name", "SubjectName", "name");
  const subjectCode = getExcelCell(row, "Subject Code", "SubjectCode", "code");
  if (!subjectName) throw new Error("Subject Name is required.");
  if (!subjectCode) throw new Error("Subject Code is required.");
  const subjectBody: Record<string, unknown> = {
    classId: String(classRef._id),
    classOrder,
    name: subjectName,
    code: subjectCode,
  };
  const duplicateSubject = await Subject.findOne({
    workspaceId,
    classId: classRef._id,
    code: subjectCode.trim().toUpperCase(),
  });
  if (duplicateSubject) {
    await applySubjectPayload(workspaceId, subjectBody, String(duplicateSubject._id));
    await Subject.findByIdAndUpdate(duplicateSubject._id, {
      $set: {
        classId: subjectBody.classId,
        name: subjectBody.name,
        code: subjectBody.code,
      },
    });
    return { action: "skipped" as const };
  }
  await applySubjectPayload(workspaceId, subjectBody);
  await Subject.create({
    ...subjectBody,
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  });
  return { action: "created" as const };
}

export function formatImportSummary(total: number, created: number, skipped: number, errors: string[]) {
  const failed = errors.length;
  const lines = [
    `Total Rows: ${total}`,
    `Imported Successfully: ${created}`,
    `Skipped (already existed): ${skipped}`,
    `Failed: ${failed}`,
  ];
  if (errors.length) {
    lines.push("", "Errors:", ...errors);
  }
  return lines.join("\n");
}