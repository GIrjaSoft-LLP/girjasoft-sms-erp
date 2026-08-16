import mongoose from "mongoose";
import { STUDENT_EXCEL_HEADERS } from "@/config/excel";
import {
  ApiError,
  applyRecordVisibility,
  errorResponse,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { cell, excelFileResponse, readExcelObjects, rowsToExcelBuffer } from "@/lib/excel";
import { Student } from "@/models/workspace";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");
    const url = new URL(request.url);
    const template = url.searchParams.get("template") === "1";
    const query = applyRecordVisibility(ctx, "students", scopedQuery(ctx.workspaceId));
    const items = template
      ? [
          {
            admissionNumber: "ADM-001",
            name: "Sample Student",
            gender: "Female",
            dateOfBirth: "2012-04-15",
            phone: "9999999999",
            email: "student@school.com",
            address: "City",
            status: "ACTIVE",
          },
        ]
      : await Student.find(query).sort({ admissionNumber: 1 }).lean();
    const buffer = await rowsToExcelBuffer(
      "Students",
      STUDENT_EXCEL_HEADERS,
      items as Array<Record<string, unknown>>,
    );
    return excelFileResponse(
      buffer,
      template ? "girjasoft-students-template.xlsx" : "girjasoft-students.xlsx",
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.create");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Excel file is required.");
    const rows = await readExcelObjects(Buffer.from(await file.arrayBuffer()));
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const admissionNumber = cell(row, "admissionNumber", "AdmissionNumber", "AdmissionNo");
      const name = cell(row, "name", "Name");
      if (!admissionNumber || !name) {
        errors.push(`Row ${index + 2}: admissionNumber and name are required.`);
        continue;
      }
      try {
        const existing = await Student.findOne(
          scopedQuery(ctx.workspaceId, { admissionNumber }),
        );
        if (existing) {
          skipped += 1;
          continue;
        }
        await Student.create({
          workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
          admissionNumber,
          name,
          gender: cell(row, "gender") || "",
          dateOfBirth: cell(row, "dateOfBirth", "dob") || "",
          phone: cell(row, "phone") || "",
          email: cell(row, "email") || "",
          address: cell(row, "address") || "",
          status: cell(row, "status") || "ACTIVE",
        });
        created += 1;
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await logWorkspace(ctx.session, ctx.workspaceId, "STUDENTS_IMPORTED", "students", "", {
      created,
      skipped,
    });
    return Response.json({ created, skipped, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
