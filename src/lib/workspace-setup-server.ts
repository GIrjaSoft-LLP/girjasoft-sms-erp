import {
  CURRENT_MODULE_CONFIG_VERSION,
  ensureWorkspaceModuleConfiguration,
} from "@/lib/workspace-modules";
import { syncSystemRolesForWorkspace } from "@/lib/system-role-sync";

/** Server-only: migrate modules and sync system role permissions for a workspace. */
export async function ensureWorkspaceReady(workspace: {
  _id?: unknown;
  enabledModules?: string[] | null;
  moduleConfigVersion?: number | null;
  save: () => Promise<unknown>;
}) {
  const beforeVersion = workspace.moduleConfigVersion ?? 1;
  const enabled = await ensureWorkspaceModuleConfiguration(workspace);
  if (beforeVersion < CURRENT_MODULE_CONFIG_VERSION && workspace._id) {
    await syncSystemRolesForWorkspace(String(workspace._id));
  }
  return enabled;
}
