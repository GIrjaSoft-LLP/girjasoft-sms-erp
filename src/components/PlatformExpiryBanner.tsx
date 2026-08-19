"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/workspace-validity";

type Alert = {
  id: string;
  schoolName: string;
  code: string;
  expired: boolean;
  daysRemaining: number | null;
  validityTill: string;
};

export function PlatformExpiryBanner({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: () => void }) {
  if (!alerts.length) return null;
  const alert = alerts[0];
  const days = alert.daysRemaining ?? 0;
  const expiryDate = formatDisplayDate(alert.validityTill);
  return (
    <div className={`shrink-0 border-b px-4 py-3 text-sm ${alert.expired ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{alert.expired ? "Subscription Expired" : "Subscription Expiry Warning"}</p>
          <p className="mt-1">
            {alert.expired
              ? `${alert.schoolName} subscription expired on ${expiryDate}. Renew the subscription to restore active access.`
              : `${alert.schoolName} subscription expires in ${days} day${days === 1 ? "" : "s"}. Please renew before ${expiryDate} to prevent service deactivation.`}
          </p>
          {alerts.length > 1 ? <p className="mt-1 text-xs opacity-80">{alerts.length - 1} more workspace(s) need attention.</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <Link className="font-medium underline" href={`/platform/workspaces/${alert.id}/edit`}>
            Manage Workspace
          </Link>
          <button type="button" className="text-xs underline opacity-80" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
