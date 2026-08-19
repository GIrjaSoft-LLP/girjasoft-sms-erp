import { ERP_MODULES, ERP_MODULE_MAP, LEGACY_DEFAULT_ENABLED_MODULE_IDS, NAV_HREF_TO_MODULE, RESOURCE_TO_MODULE, getAllAvailableModuleIds, getDefaultEnabledModuleIds, type ErpModuleDefinition } from "@/config/erp-modules";

type WorkspaceLike = {
  enabledModules?: string[] | null;
  moduleConfigVersion?: number | null;
};

export const CURRENT_MODULE_CONFIG_VERSION = 3;

/** Modules added after initial rollout — enabled once per workspace when config version migrates. */
const MODULE_VERSION_ADDITIONS: Record<number, string[]> = {
  3: ["admissions"],
};

export function migrateEnabledModules(stored: string[] | null | undefined) {
  const allAvailable = getAllAvailableModuleIds();
  if (!stored || stored.length === 0) {
    return allAvailable;
  }

  const enabled = new Set<string>();
  for (const id of stored) {
    if (allAvailable.includes(id)) enabled.add(id);
  }

  for (const id of allAvailable) {
    if (!LEGACY_DEFAULT_ENABLED_MODULE_IDS.includes(id as (typeof LEGACY_DEFAULT_ENABLED_MODULE_IDS)[number])) {
      enabled.add(id);
    }
  }

  return sanitizeEnabledModules([...enabled]);
}

export function resolveEnabledModules(workspace: WorkspaceLike | null | undefined) {
  const allAvailable = getAllAvailableModuleIds();
  const stored = workspace?.enabledModules;
  const version = workspace?.moduleConfigVersion ?? 1;

  if (version >= CURRENT_MODULE_CONFIG_VERSION) {
    if (!stored?.length) return allAvailable;
    return sanitizeEnabledModules(stored);
  }

  if (workspace?.moduleConfigVersion === 2) {
    if (!stored?.length) return allAvailable;
    return sanitizeEnabledModules(stored);
  }

  return migrateEnabledModules(stored);
}

function applyModuleVersionMigrations(enabled: string[], fromVersion: number) {
  const next = new Set(enabled);
  for (let version = fromVersion + 1; version <= CURRENT_MODULE_CONFIG_VERSION; version += 1) {
    for (const moduleId of MODULE_VERSION_ADDITIONS[version] ?? []) {
      if (ERP_MODULE_MAP[moduleId]?.status === "available") {
        next.add(moduleId);
      }
    }
  }
  return sanitizeEnabledModules([...next]);
}

export async function ensureWorkspaceModuleConfiguration(workspace: {
  _id?: unknown;
  enabledModules?: string[] | null;
  moduleConfigVersion?: number | null;
  save: () => Promise<unknown>;
}) {
  const currentVersion = workspace.moduleConfigVersion ?? 1;
  let enabled: string[];

  if (currentVersion >= CURRENT_MODULE_CONFIG_VERSION) {
    enabled = sanitizeEnabledModules(workspace.enabledModules ?? []);
    return enabled;
  }

  if (currentVersion === 2) {
    enabled = sanitizeEnabledModules(workspace.enabledModules ?? []);
  } else {
    enabled = migrateEnabledModules(workspace.enabledModules);
  }

  enabled = applyModuleVersionMigrations(enabled, Math.max(currentVersion, 1));

  workspace.enabledModules = enabled;
  workspace.moduleConfigVersion = CURRENT_MODULE_CONFIG_VERSION;
  await workspace.save();
  return enabled;
}

export function isModuleEnabledForWorkspace(workspace: WorkspaceLike | null | undefined, moduleId: string) {
  return resolveEnabledModules(workspace).includes(moduleId);
}

export function isResourceEnabledForWorkspace(workspace: WorkspaceLike | null | undefined, resourceKey: string) {
  const moduleId = RESOURCE_TO_MODULE[resourceKey];
  if (!moduleId) return true;
  return isModuleEnabledForWorkspace(workspace, moduleId);
}

export function moduleForHref(href: string) {
  if (NAV_HREF_TO_MODULE[href]) return NAV_HREF_TO_MODULE[href];
  if (href.startsWith("/finance/")) {
    const resource = href.split("/")[2];
    if (resource && RESOURCE_TO_MODULE[resource]) return RESOURCE_TO_MODULE[resource];
  }
  if (href.startsWith("/modules/")) {
    const resource = href.split("/")[2];
    if (resource) return RESOURCE_TO_MODULE[resource] ? RESOURCE_TO_MODULE[resource] : undefined;
  }
  return NAV_HREF_TO_MODULE[href];
}

export function moduleForPathname(pathname: string) {
  const exact = moduleForHref(pathname);
  if (exact) return exact;
  for (const [href, moduleId] of Object.entries(NAV_HREF_TO_MODULE)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return moduleId;
  }
  if (pathname.startsWith("/finance/")) {
    const resource = pathname.split("/")[2];
    const moduleId = resource ? RESOURCE_TO_MODULE[resource] : undefined;
    return moduleId ?? null;
  }
  if (pathname.startsWith("/modules/")) {
    const resource = pathname.split("/")[2];
    return resource ? RESOURCE_TO_MODULE[resource] ?? null : null;
  }
  if (pathname.startsWith("/settings/staff")) return "hr-staff";
  if (pathname.startsWith("/modules/admissions") || pathname.startsWith("/settings/admission")) return "admissions";
  if (pathname.startsWith("/modules/student-info") || pathname.startsWith("/settings/student-info")) return "student-info";
  if (pathname.startsWith("/modules/attendance")) return "attendance";
  return null;
}

export function getDependentModules(moduleId: string) {
  return ERP_MODULES.filter((module) => module.dependencies.includes(moduleId)).map((module) => module.id);
}

export function validateModuleDisable(moduleId: string, enabledModuleIds: string[]) {
  const module = ERP_MODULE_MAP[moduleId];
  if (!module) return { ok: false, message: "Unknown module." };
  if (module.isCore) {
    return { ok: false, message: "Core modules cannot be disabled." };
  }
  const dependents = ERP_MODULES.filter(
    (item) => item.dependencies.includes(moduleId) && enabledModuleIds.includes(item.id),
  );
  if (dependents.length) {
    return {
      ok: false,
      message: `Cannot disable ${module.name}. The following enabled modules depend on it: ${dependents.map((item) => item.name).join(", ")}.`,
      dependents: dependents.map((item) => item.id),
    };
  }
  return { ok: true };
}

export function sanitizeEnabledModules(input: string[]) {
  const allowed = new Set(ERP_MODULES.filter((module) => module.status === "available").map((module) => module.id));
  const next = [...new Set(input.filter((id) => allowed.has(id)))];
  for (const module of ERP_MODULES) {
    if (module.isCore && !next.includes(module.id)) next.push(module.id);
  }
  return next.sort(
    (a, b) => (ERP_MODULE_MAP[a]?.displayOrder ?? 0) - (ERP_MODULE_MAP[b]?.displayOrder ?? 0),
  );
}

export function getAllEnabledModuleIdsForSave(input: string[]) {
  return sanitizeEnabledModules(input);
}

export function modulesForWorkspace(
  workspace: WorkspaceLike | null | undefined,
  permissions: string[],
  allowAll = false,
) {
  const enabled = new Set(resolveEnabledModules(workspace));
  return ERP_MODULES.filter((module) => {
    if (module.status !== "available") return false;
    if (!enabled.has(module.id)) return false;
    if (allowAll) return true;
    if (!module.permissions.length) return true;
    return module.permissions.some((permission) => permissions.includes(permission));
  });
}

export function navHrefAllowed(
  href: string,
  workspace: WorkspaceLike | null | undefined,
  permissions: string[],
  allowAll = false,
) {
  const moduleId = moduleForHref(href);
  if (!moduleId) return true;
  const module = ERP_MODULE_MAP[moduleId];
  if (!module || module.status !== "available") return false;
  if (!isModuleEnabledForWorkspace(workspace, moduleId)) return false;
  if (allowAll) return true;
  if (!module.permissions.length) return true;
  return module.permissions.some((permission) => permissions.includes(permission));
}

export function serializeModulesForAdmin(enabledModuleIds: string[]) {
  return ERP_MODULES.map((module) => ({
    id: module.id,
    name: module.name,
    description: module.description,
    category: module.category,
    isCore: module.isCore,
    status: module.status,
    dependencies: module.dependencies,
    enabled:
      module.status === "coming_soon"
        ? enabledModuleIds.includes(module.id) || module.defaultEnabled
        : enabledModuleIds.includes(module.id),
  }));
}

export { getDefaultEnabledModuleIds, getAllAvailableModuleIds };
export type { ErpModuleDefinition };
