import { cookies } from "next/headers";
import { errorResponse, json, requireSuperAdmin } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { cookieOptions, VIEW_WORKSPACE_COOKIE, getViewWorkspaceId } from "@/lib/session";

export async function POST() {
  try {
    const session = await requireSuperAdmin();
    const viewId = await getViewWorkspaceId();
    const store = await cookies();
    store.set(VIEW_WORKSPACE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    if (viewId) {
      await logPlatform(session, "WORKSPACE_EXITED", {}, viewId);
    }
    return json({ ok: true, redirectTo: "/platform/dashboard" });
  } catch (error) {
    return errorResponse(error);
  }
}
