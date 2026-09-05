import { errorResponse, json, requirePerm, requireWorkspaceContext } from "@/lib/api/guards";
import { listFeeStudents } from "@/lib/fees/service";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "fees.view");
    const url = new URL(request.url);
    return json(
      await listFeeStudents(ctx, url.searchParams.get("classId") ?? "", url.searchParams.get("sectionId") ?? ""),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
