import mongoose from "mongoose";
import { EXCEL_UNIQUE_KEYS, isExcelModule } from "@/config/excel";
import { RESOURCES } from "@/config/resources";
import {
  ApiError,
  applyRecordVisibility,
  errorResponse,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { getResource } from "@/lib/api/tenant-resource";
import { logWorkspace } from "@/lib/audit";
import { cell, excelFileResponse, readExcelObjects, rowsToExcelBuffer } from "@/lib/excel";
import { ensureParentLogin, parseObjectIds, syncParentStudents } from "@/lib/parent-account";
import { ensureTeacherLogin } from "@/lib/teacher-account";
import { Parent, Teacher } from "@/models/workspace";

type Ctx = { params: Promise<{ resource: string }> };

function headersFor(resourceKey: string) {
  return RESOURCES[resourceKey].fields.map((field) => field.name);
}

function sampleRow(resourceKey: string) {
  const row: Record<string, unknown> = {};
  for (const field of RESOURCES[resourceKey].fields) {
    if (field.options?.length) {
      row[field.name] = field.options[0];
    } else if (field.type === "number") {
      row[field.name] = 1;
    } else if (field.type === "date") {
      row[field.name] = "2026-04-01";
    } else if (field.name.toLowerCase().endsWith("id")) {
      row[field.name] = "PASTE_ID_FROM_EXPORT";
    } else if (field.required) {
      row[field.name] = `Sample ${field.label}`;
    } else {
      row[field.name] = "";
    }
  }
  return row;
}

function parseValue(resourceKey: string, fieldName: string, raw: string) {
  const field = RESOURCES[resourceKey].fields.find((item) => item.name === fieldName);
  if (!raw) return undefined;
  if (field?.type === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  return raw;
}

function rowToDocument(resourceKey: string, row: Record<string, string>) {
  const document: Record<string, unknown> = {};
  for (const field of RESOURCES[resourceKey].fields) {
    const raw = cell(row, field.name);
    const value = parseValue(resourceKey, field.name, raw);
    if (value !== undefined) document[field.name] = value;
  }
  return document;
}

function uniqueQuery(resourceKey: string, document: Record<string, unknown>) {
  const keys = EXCEL_UNIQUE_KEYS[resourceKey] ?? [];
  if (!keys.length) return null;
  const query: Record<string, unknown> = {};
  for (const key of keys) {
    if (document[key] === undefined || document[key] === "") return null;
    query[key] = document[key];
  }
  return query;
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { resource: resourceKey } = await ctx.params;
    if (!isExcelModule(resourceKey) || !RESOURCES[resourceKey]) {
      throw new ApiError(404, "Excel is not available for this section.");
    }
    const tenant = await requireWorkspaceContext();
    const resource = getResource(resourceKey);
    requirePerm(tenant, `${resource.permission}.view`);

    const template = new URL(request.url).searchParams.get("template") === "1";
    const headers = headersFor(resourceKey);
    const records = template
      ? [sampleRow(resourceKey)]
      : ((await resource.model
          .find(applyRecordVisibility(tenant, resourceKey, scopedQuery(tenant.workspaceId)))
          .sort({ createdAt: -1 })
          .limit(10000)
          .lean()) as Array<Record<string, unknown>>);

    const buffer = await rowsToExcelBuffer(resource.label, headers, records);
    return excelFileResponse(
      buffer,
      template
        ? `girjasoft-${resourceKey}-template.xlsx`
        : `girjasoft-${resourceKey}.xlsx`,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { resource: resourceKey } = await ctx.params;
    if (!isExcelModule(resourceKey) || !RESOURCES[resourceKey]) {
      throw new ApiError(404, "Excel is not available for this section.");
    }
    const tenant = await requireWorkspaceContext();
    const resource = getResource(resourceKey);
    requirePerm(tenant, `${resource.permission}.create`);
    if (resourceKey === "payments") {
      requirePerm(tenant, "fees.collect");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Excel file is required.");
    const rows = await readExcelObjects(Buffer.from(await file.arrayBuffer()));
    const required = RESOURCES[resourceKey].fields.filter((field) => field.required).map((field) => field.name);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const document = rowToDocument(resourceKey, row);
      const missing = required.filter((name) => document[name] === undefined || document[name] === "");
      if (missing.length) {
        errors.push(`Row ${index + 2}: missing ${missing.join(", ")}.`);
        continue;
      }
      try {
        const duplicate = uniqueQuery(resourceKey, document);
        if (duplicate) {
          const existing = await resource.model.findOne(scopedQuery(tenant.workspaceId, duplicate));
          if (existing) {
            skipped += 1;
            continue;
          }
        }
        if (resourceKey === "parents") {
          const studentIds = parseObjectIds(document.studentIds);
          const parent = await Parent.create({
            ...document,
            studentIds,
            workspaceId: new mongoose.Types.ObjectId(tenant.workspaceId),
          });
          const linked = await syncParentStudents(
            tenant.workspaceId,
            parent._id as mongoose.Types.ObjectId,
            studentIds,
          );
          parent.studentIds = linked;
          await parent.save();
          await ensureParentLogin({
            workspaceId: tenant.workspaceId,
            parent,
            createPassword: true,
          });
        } else if (resourceKey === "teachers") {
          const teacher = await Teacher.create({
            ...document,
            workspaceId: new mongoose.Types.ObjectId(tenant.workspaceId),
          });
          try {
            await ensureTeacherLogin({
              workspaceId: tenant.workspaceId,
              teacher,
              createPassword: true,
            });
          } catch (error) {
            await teacher.deleteOne();
            throw error;
          }
        } else {
          await resource.model.create({
            ...document,
            workspaceId: new mongoose.Types.ObjectId(tenant.workspaceId),
          });
        }
        created += 1;
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await logWorkspace(
      tenant.session,
      tenant.workspaceId,
      `${resourceKey.toUpperCase()}_IMPORTED`,
      resourceKey,
      "",
      { created, skipped },
    );
    return Response.json({ created, skipped, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
