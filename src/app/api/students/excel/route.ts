import {
  ApiError,
  applyRecordVisibility,
  errorResponse,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { excelFileResponse, readExcelObjects, rowsToExcelBuffer } from "@/lib/excel";
import {
  buildStudentImportLookups,
  exportStudentExcelRows,
  importStudentExcelRow,
  studentExcelHeaders,
  studentExcelSampleRow,
} from "@/lib/excel-students";
import { formatImportSummary } from "@/lib/excel-academic";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");
    const url = new URL(request.url);
    const template = url.searchParams.get("template") === "1";
    const query = applyRecordVisibility(ctx, "students", scopedQuery(ctx.workspaceId));
    const items = template ? [studentExcelSampleRow()] : await exportStudentExcelRows(query);
    const buffer = await rowsToExcelBuffer("Students", studentExcelHeaders(), items);
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
    const lookups = await buildStudentImportLookups(ctx.workspaceId);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      try {
        const result = await importStudentExcelRow(ctx.workspaceId, row, lookups);
        if (result.action === "created") created += 1;
        else skipped += 1;
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await logWorkspace(ctx.session, ctx.workspaceId, "STUDENTS_IMPORTED", "students", "", {
      created,
      skipped,
      failed: errors.length,
    });
    return Response.json({
      total: rows.length,
      created,
      skipped,
      failed: errors.length,
      errors,
      errorReport: formatImportSummary(rows.length, created, skipped, errors),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
