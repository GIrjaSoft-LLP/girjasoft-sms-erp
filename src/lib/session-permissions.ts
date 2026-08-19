import { mergePermissions } from "@/lib/rbac";
import { hasPlatformPermission } from "@/lib/platform-access";
import { isPlatformActor, type SessionPayload } from "@/lib/session";
import { Role, User } from "@/models/identity";

export async function resolveWorkspacePermissionsForUser(userId: string, workspaceId: string) {
  const user = await User.findOne({ _id: userId, workspaceId }).select("roleIds").lean();
  if (!user?.roleIds?.length) return [];
  const roles = await Role.find({ _id: { $in: user.roleIds }, workspaceId }).lean();
  return mergePermissions(roles.map((role) => role.permissions ?? []));
}

export async function resolveEffectivePermissions(session: SessionPayload) {
  if (session.accountType !== "WORKSPACE" || !session.workspaceId) {
    return session.permissions;
  }
  return resolveWorkspacePermissionsForUser(session.sub, session.workspaceId);
}

export function shouldAllowAllModules(session: SessionPayload, impersonating: boolean) {
  if (session.sessionRole === "SUPER_ADMIN") return true;
  return impersonating && isPlatformActor(session) && hasPlatformPermission(session, "platform.workspaces.manage");
}
