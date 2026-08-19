export const PLATFORM_PERMISSIONS = [
  "platform.workspaces.view",
  "platform.workspaces.create",
  "platform.workspaces.edit",
  "platform.workspaces.delete",
  "platform.workspaces.manage",
  "platform.workspaceUsers.view",
  "platform.workspaceUsers.edit",
  "platform.workspaceUsers.delete",
  "platform.users.view",
  "platform.users.create",
  "platform.users.edit",
  "platform.users.delete",
  "platform.roles.view",
  "platform.roles.create",
  "platform.roles.edit",
  "platform.roles.delete",
  "platform.tickets.view",
  "platform.tickets.edit",
  "platform.tickets.assign",
  "platform.settings.view",
  "platform.settings.edit",
  "platform.audit.view",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_PERMISSION_CATALOG = [
  { key: "workspaces", label: "Workspaces", actions: ["view", "create", "edit", "delete", "manage"] },
  { key: "workspaceUsers", label: "School Users", actions: ["view", "edit", "delete"] },
  { key: "users", label: "Platform Users", actions: ["view", "create", "edit", "delete"] },
  { key: "roles", label: "Roles", actions: ["view", "create", "edit", "delete"] },
  { key: "tickets", label: "Tickets", actions: ["view", "edit", "assign"] },
  { key: "settings", label: "Settings", actions: ["view", "edit"] },
  { key: "audit", label: "Audit Logs", actions: ["view"] },
];

const VIEW_ONLY: PlatformPermission[] = [
  "platform.workspaces.view",
  "platform.workspaceUsers.view",
  "platform.users.view",
  "platform.roles.view",
  "platform.tickets.view",
  "platform.settings.view",
  "platform.audit.view",
];

const TICKET_ADMIN_PERMS: PlatformPermission[] = [
  "platform.tickets.view",
  "platform.tickets.edit",
  "platform.tickets.assign",
];

export const PLATFORM_SYSTEM_ROLES = [
  {
    name: "Admin",
    slug: "admin",
    description: "Full platform access",
    isSystem: true,
    permissions: [...PLATFORM_PERMISSIONS],
  },
  {
    name: "Reader",
    slug: "reader",
    description: "Read-only platform access",
    isSystem: true,
    permissions: VIEW_ONLY,
  },
  {
    name: "Ticket Admin",
    slug: "ticket_admin",
    description: "Ticket management access",
    isSystem: true,
    permissions: TICKET_ADMIN_PERMS,
  },
] as const;

export const PLATFORM_EXPIRY_WARNING_DAYS = 30;

export function platformHomePath(permissions: string[]) {
  if (permissions.includes("platform.workspaces.view")) return "/platform/dashboard";
  if (permissions.includes("platform.tickets.view")) return "/platform/tickets";
  return "/platform/settings";
}
