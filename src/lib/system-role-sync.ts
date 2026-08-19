import { DEFAULT_ROLE_DEFINITIONS } from "@/config/permissions";
import { Role } from "@/models/identity";

/** Merge newly added permissions into existing system roles without removing custom grants. */
export async function syncSystemRolesForWorkspace(workspaceId: string) {
  let updated = 0;
  for (const def of DEFAULT_ROLE_DEFINITIONS.filter((role) => role.isSystem)) {
    const role = await Role.findOne({ workspaceId, slug: def.slug });
    if (!role) continue;
    const current = new Set(role.permissions ?? []);
    let changed = false;
    for (const permission of def.permissions) {
      if (!current.has(permission)) {
        current.add(permission);
        changed = true;
      }
    }
    if (changed) {
      role.permissions = [...current].sort();
      await role.save();
      updated += 1;
    }
  }
  return updated;
}
