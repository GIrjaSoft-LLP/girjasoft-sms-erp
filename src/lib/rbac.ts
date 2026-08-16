import { DEFAULT_ROLE_DEFINITIONS } from "@/config/permissions";

export function mergePermissions(rolePermissionLists: string[][]) {
  return Array.from(new Set(rolePermissionLists.flat()));
}

export function hasPermission(permissions: string[], required: string) {
  return permissions.includes(required);
}

export function assertAssignablePermissions(
  actorPermissions: string[],
  requestedPermissions: string[],
) {
  const illegal = requestedPermissions.filter(
    (permission) => !actorPermissions.includes(permission),
  );
  if (illegal.length) {
    const error = new Error("Cannot assign permissions outside your authority.");
    (error as Error & { status: number; details: string[] }).status = 403;
    (error as Error & { status: number; details: string[] }).details = illegal;
    throw error;
  }
}

export function getDefaultRoleDefinitions() {
  return DEFAULT_ROLE_DEFINITIONS;
}

export function isStudentLike(roleSlugs: string[]) {
  return roleSlugs.includes("student");
}

export function isParentLike(roleSlugs: string[]) {
  return roleSlugs.includes("parent");
}

export function isTeacherLike(roleSlugs: string[]) {
  return roleSlugs.includes("teacher");
}
