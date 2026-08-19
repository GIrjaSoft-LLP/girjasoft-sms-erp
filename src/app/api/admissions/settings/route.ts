import { z } from "zod";
import { errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { getAdmissionSettings, saveAdmissionSettings } from "@/lib/admissions/settings";
import { requireAdmissionContext } from "@/lib/admissions/guard";

export async function GET() {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const settings = await getAdmissionSettings(ctx.workspaceId);
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.edit");
    const body = z.record(z.string(), z.unknown()).parse(await request.json());
    const settings = await saveAdmissionSettings(ctx.workspaceId, body as Partial<import("@/config/admissions").AdmissionSettings>);
    await logWorkspace(ctx.session, ctx.workspaceId, "ADMISSION_SETTINGS_UPDATED", "admissions", ctx.workspaceId);
    return json({ settings });
  } catch (error) {
    return errorResponse(error);
  }
}
