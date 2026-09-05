import { z } from "zod";
import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { importValidatedMarks } from "@/lib/marks/bulk";

const importSchema = z.object({
  examId: z.string().min(1),
  rows: z.array(
    z.object({
      excelRow: z.number(),
      studentId: z.string().min(1),
      classId: z.string().min(1),
      sectionId: z.string().min(1),
      studentName: z.string(),
      subjects: z.array(
        z.object({
          subjectId: z.string().min(1),
          maxMarks: z.number().positive(),
          marksObtained: z.number().min(0),
        }),
      ),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const input = importSchema.parse(await request.json());
    const result = await importValidatedMarks(ctx, input.examId, input.rows);
    await logWorkspace(ctx.session, ctx.workspaceId, "MARKS_BULK_IMPORTED", "marks", input.examId, {
      imported: result.imported,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
    });
    return json({ message: "Bulk marks upload completed.", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
