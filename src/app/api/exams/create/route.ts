import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { assertExamCreateAllowed, createExamWithSchedules } from "@/lib/exams/service";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    assertExamCreateAllowed(ctx);
    const body = await request.json();
    const result = await createExamWithSchedules(ctx, body);
    return json({ message: "Exam created successfully.", ...result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
