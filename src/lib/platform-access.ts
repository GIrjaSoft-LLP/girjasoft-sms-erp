import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { PLATFORM_PERMISSIONS, PLATFORM_SYSTEM_ROLES } from "@/config/platform-rbac";
import { ApiError } from "@/lib/api/errors";
import { connectMongo } from "@/lib/mongodb";
import { hasPermission } from "@/lib/rbac";
import { getSession, isPlatformActor, isPlatformSuperAdmin, type SessionPayload } from "@/lib/session";
import { PlatformAdmin, PlatformRole } from "@/models/platform";

export function hasPlatformPermission(session: SessionPayload, permission: string) {
  if (isPlatformSuperAdmin(session)) return true;
  if (session.roleSlugs.includes("admin") && session.accountType === "PLATFORM") {
    return PLATFORM_PERMISSIONS.includes(permission as (typeof PLATFORM_PERMISSIONS)[number]);
  }
  return hasPermission(session.permissions, permission);
}

export async function ensurePlatformSystemRoles() {
  for (const role of PLATFORM_SYSTEM_ROLES) {
    await PlatformRole.findOneAndUpdate(
      { slug: role.slug },
      {
        name: role.name,
        slug: role.slug,
        description: role.description,
        permissions: [...role.permissions],
        isSystem: true,
        status: "ACTIVE",
      },
      { upsert: true, new: true },
    );
  }
}

export async function permissionsForPlatformRole(roleSlug: string) {
  await ensurePlatformSystemRoles();
  if (roleSlug === "super_admin") return [...PLATFORM_PERMISSIONS];
  const role = await PlatformRole.findOne({ slug: roleSlug, status: "ACTIVE" }).lean();
  return role?.permissions ?? [];
}

export async function buildPlatformSession(admin: {
  _id: unknown;
  email: string;
  name: string;
  role?: string;
}): Promise<SessionPayload> {
  const email = admin.email.toLowerCase();
  const isOwner = email === SUPER_ADMIN_EMAIL.toLowerCase() || admin.role === "SUPER_ADMIN";
  const roleMap: Record<string, string> = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    READER: "reader",
    TICKET_ADMIN: "ticket_admin",
  };
  const roleSlug = isOwner ? "super_admin" : roleMap[String(admin.role || "ADMIN").toUpperCase()] ?? "reader";
  const permissions = isOwner ? [...PLATFORM_PERMISSIONS] : await permissionsForPlatformRole(roleSlug);
  return {
    sub: String(admin._id),
    email: admin.email,
    name: admin.name,
    accountType: "PLATFORM",
    sessionRole: isOwner ? "SUPER_ADMIN" : "PLATFORM_USER",
    workspaceId: null,
    permissions,
    roleSlugs: [roleSlug],
  };
}

export async function requirePlatformSession() {
  await connectMongo();
  const session = await getSession();
  if (!session || !isPlatformActor(session)) {
    throw new ApiError(403, "Platform access required.");
  }
  return session;
}

export async function requirePlatformPerm(permission: string) {
  const session = await requirePlatformSession();
  if (!hasPlatformPermission(session, permission)) {
    throw new ApiError(403, "Permission denied.");
  }
  return session;
}

export async function countActivePlatformAdmins() {
  return PlatformAdmin.countDocuments({
    status: "ACTIVE",
    role: { $in: ["SUPER_ADMIN", "ADMIN", "admin"] },
  });
}

export async function assertNotLastAdmin(admin: { _id?: unknown; role?: string; status?: string; email?: string }) {
  const isAdmin =
    admin.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
    admin.role === "SUPER_ADMIN" ||
    String(admin.role || "").toLowerCase() === "admin";
  if (!isAdmin) return;
  const remaining = await PlatformAdmin.countDocuments({
    status: "ACTIVE",
    _id: { $ne: admin._id },
    $or: [{ role: "SUPER_ADMIN" }, { role: "ADMIN" }, { role: "admin" }, { email: SUPER_ADMIN_EMAIL.toLowerCase() }],
  });
  if (remaining < 1) {
    throw new ApiError(400, "Cannot remove Admin role from the last active Admin.");
  }
}
