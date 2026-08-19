import { PLATFORM_EXPIRY_WARNING_DAYS } from "@/config/platform-rbac";

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysRemaining(validityTill: Date | string | null | undefined) {
  if (!validityTill) return null;
  const end = startOfDay(new Date(validityTill));
  if (Number.isNaN(end.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

export function isWorkspaceExpired(validityTill: Date | string | null | undefined) {
  const days = daysRemaining(validityTill);
  return days !== null && days < 0;
}

export function formatDisplayDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function workspaceSubscription(workspace: {
  status?: string;
  validityTill?: Date | string | null;
}) {
  const days = daysRemaining(workspace.validityTill);
  const expired = days !== null && days < 0;
  const expiring = days !== null && days >= 0 && days <= PLATFORM_EXPIRY_WARNING_DAYS;
  let subscriptionStatus = "Active";
  if (workspace.status && workspace.status !== "ACTIVE") {
    subscriptionStatus = workspace.status === "SUSPENDED" ? "Inactive" : workspace.status.charAt(0) + workspace.status.slice(1).toLowerCase();
  } else if (expired) {
    subscriptionStatus = "Expired";
  } else if (expiring) {
    subscriptionStatus = "Expiring Soon";
  }
  return {
    validityTill: workspace.validityTill ? new Date(workspace.validityTill).toISOString() : "",
    daysRemaining: days,
    daysLabel: days === null ? "—" : days < 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"}`,
    expired,
    expiring,
    warning: Boolean(workspace.status === "ACTIVE" || !workspace.status) && (expired || expiring),
    subscriptionStatus,
  };
}
