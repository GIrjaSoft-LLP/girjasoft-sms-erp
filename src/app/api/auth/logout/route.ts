import { cookies } from "next/headers";
import { errorResponse, json, requireSession } from "@/lib/api/guards";
import { logPlatform, logWorkspace } from "@/lib/audit";
import { cookieOptions, SESSION_COOKIE, VIEW_WORKSPACE_COOKIE, isPlatformSuperAdmin } from "@/lib/session";

export async function POST() {
  try {
    const session = await requireSession();
    if (isPlatformSuperAdmin(session)) {
      await logPlatform(session, "SUPER_ADMIN_LOGOUT");
    } else if (session.workspaceId) {
      await logWorkspace(session, session.workspaceId, "USER_LOGOUT", "users", session.sub);
    }
    const store = await cookies();
    store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    store.set(VIEW_WORKSPACE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
