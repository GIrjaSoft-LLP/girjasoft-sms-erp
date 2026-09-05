import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listPublicHolidays, savePublicHoliday } from "@/lib/hr/leave";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.view");
    return json(await listPublicHolidays(ctx));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "leave.create");
    return json(await savePublicHoliday(ctx, await request.json()), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
