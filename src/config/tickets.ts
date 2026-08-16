import { WORKSPACE_NAV } from "@/config/nav";

export const TICKET_TYPES = ["INCIDENT", "REQUEST"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TICKET_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_SCHOOL",
  "RESOLVED",
  "CLOSED",
] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function supportModules() {
  const labels = WORKSPACE_NAV.flatMap((item) =>
    item.children?.length ? [item.label, ...item.children.map((child) => child.label)] : [item.label],
  );
  return ["Dashboard", "Reports", "Notices", ...labels, "Other"];
}

export function ticketLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
