import { z } from "zod";
import { ApiError, errorResponse, json, requireSession } from "@/lib/api/guards";
import { studentIdAllowed } from "@/lib/parent-access";
import { isParentLike } from "@/lib/rbac";
import { cookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!isParentLike(session.roleSlugs)) {
      throw new ApiError(403, "Only parent accounts can switch children.");
    }
    const { studentId } = z.object({ studentId: z.string() }).parse(await request.json());
    if (!studentIdAllowed(session.linkedStudentIds ?? [], studentId)) {
      throw new ApiError(403, "Forbidden.");
    }
    const next = await signSession({
      ...session,
      linkedStudentId: studentId,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, next, { ...cookieOptions, maxAge: 60 * 60 * 12 });
    return json({ ok: true, activeStudentId: studentId });
  } catch (error) {
    return errorResponse(error);
  }
}
