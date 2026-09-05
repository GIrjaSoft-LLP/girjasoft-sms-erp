import { ApiError, type TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";

export const NOTICE_AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  STAFF: "Staff / Teachers",
  STUDENTS: "Students",
  PARENTS: "Parents",
};

export function formatNoticeAudience(audience?: string | null) {
  const key = String(audience ?? "ALL").trim().toUpperCase() || "ALL";
  return NOTICE_AUDIENCE_LABELS[key] ?? key;
}

export function getAllowedNoticeAudiences(ctx: TenantContext): string[] | null {
  if (ctx.impersonating || isWorkspaceAdmin(ctx)) return null;
  if (isParentLike(ctx.session.roleSlugs)) return ["ALL", "PARENTS"];
  if (isStudentLike(ctx.session.roleSlugs)) return ["ALL", "STUDENTS"];
  return ["ALL", "STAFF"];
}

export function noticeAudienceAllowed(ctx: TenantContext, audience?: string | null) {
  const allowed = getAllowedNoticeAudiences(ctx);
  if (!allowed) return true;
  const value = String(audience ?? "ALL").trim().toUpperCase() || "ALL";
  return allowed.includes(value);
}

export function applyNoticeAudienceToQuery(
  ctx: TenantContext,
  resource: string,
  query: Record<string, unknown>,
) {
  if (resource !== "notices") return;
  const allowed = getAllowedNoticeAudiences(ctx);
  if (!allowed) return;

  const audienceClause = {
    $or: [
      { audience: { $in: allowed } },
      { audience: { $in: ["", null] } },
      { audience: { $exists: false } },
    ],
  };

  if (query.$or) {
    query.$and = [...(Array.isArray(query.$and) ? query.$and : []), { $or: query.$or }, audienceClause];
    delete query.$or;
    return;
  }
  query.$and = [...(Array.isArray(query.$and) ? query.$and : []), audienceClause];
}

export function assertNoticeReadable(ctx: TenantContext, notice: { audience?: string | null }) {
  if (!noticeAudienceAllowed(ctx, notice.audience)) {
    throw new ApiError(403, "You are not allowed to view this notice.");
  }
}

export function toPublicNotice(item: Record<string, unknown>) {
  return {
    _id: String(item._id ?? ""),
    title: String(item.title ?? ""),
    body: String(item.body ?? ""),
    date: String(item.date ?? ""),
    audience: formatNoticeAudience(item.audience ? String(item.audience) : "ALL"),
    createdAt: item.createdAt ? String(item.createdAt) : "",
    updatedAt: item.updatedAt ? String(item.updatedAt) : "",
  };
}
