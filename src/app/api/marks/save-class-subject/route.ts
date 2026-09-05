import { errorResponse, json, requireWorkspaceContext } from "@/lib/api/guards";
import { saveClassSubjectMarks } from "@/lib/marks/service";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    const result = await saveClassSubjectMarks(ctx, await request.json());
    return json({ message: "Marks saved successfully.", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
