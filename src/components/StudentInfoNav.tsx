"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTabs } from "@/components/SectionTabs";
import { STUDENT_INFO_ADMIN_NAV, STUDENT_INFO_PARENT_NAV } from "@/config/student-info";
import { navHrefAllowed } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

export function StudentInfoNav() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [allowAll, setAllowAll] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

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
      setImpersonating(Boolean(dashboard.impersonating));
    });
  }, []);

  const items = useMemo(() => {
    const workspaceLike = { enabledModules: enabledModuleIds };
    const isParent = roleSlugs.includes("parent") && !allowAll && !impersonating;
    const nav = isParent ? STUDENT_INFO_PARENT_NAV : STUDENT_INFO_ADMIN_NAV;
    return nav.filter((item) => {
      const permitted = allowAll || permissions.includes(item.permission);
      return permitted && navHrefAllowed(item.href, workspaceLike, permissions, allowAll);
    });
  }, [allowAll, enabledModuleIds, impersonating, permissions, roleSlugs]);

  return <SectionTabs items={items} rootPath="/modules/student-info" />;
};
