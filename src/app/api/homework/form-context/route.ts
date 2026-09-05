import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { resolveTeacherHomeworkFormContext } from "@/lib/homework/service";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "homework.view");
    const formContext = await resolveTeacherHomeworkFormContext(ctx);
    return json({ formContext });
  } catch (error) {
    return errorResponse(error);
  }
}
