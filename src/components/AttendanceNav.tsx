"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTabs } from "@/components/SectionTabs";
import { ATTENDANCE_NAV } from "@/config/attendance";
import { navHrefAllowed } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

const PORTAL_ONLY_HREFS = new Set([
  "/modules/attendance/mark",
  "/modules/attendance/register",
  "/modules/attendance/reports",
  "/modules/attendance/settings",
]);

export function AttendanceNav() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [allowAll, setAllowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
      api<{ user: { permissions?: string[]; sessionRole?: string; roleSlugs?: string[] } }>("/api/auth/me"),
      api<{ impersonating?: boolean }>("/api/dashboard").catch(() => ({ impersonating: false })),
    ]).then(([modules, me, dashboard]) => {
      setEnabledModuleIds(modules.enabledModuleIds);
      setPermissions(me.user.permissions ?? []);
      setRoleSlugs(me.user.roleSlugs ?? []);
      setAllowAll(me.user.sessionRole === "SUPER_ADMIN" || Boolean(dashboard.impersonating));
    });
  }, []);

  const items = useMemo(() => {
    const workspaceLike = { enabledModules: enabledModuleIds };
    const portalUser = roleSlugs.includes("parent") || roleSlugs.includes("student");
    return ATTENDANCE_NAV.filter((item) => {
      if (portalUser && PORTAL_ONLY_HREFS.has(item.href)) return false;
      const permitted = allowAll || permissions.includes(item.permission);
      return permitted && navHrefAllowed(item.href, workspaceLike, permissions, allowAll);
    });
  }, [allowAll, enabledModuleIds, permissions, roleSlugs]);

  return <SectionTabs items={items} rootPath="/modules/attendance" />;
}
