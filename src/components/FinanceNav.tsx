"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTabs } from "@/components/SectionTabs";
import { FINANCE_NAV } from "@/config/nav";
import { navHrefAllowed } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

export function FinanceNav() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [allowAll, setAllowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
      api<{ user: { permissions?: string[]; sessionRole?: string } }>("/api/auth/me"),
    ]).then(([modules, me]) => {
      setEnabledModuleIds(modules.enabledModuleIds);
      setPermissions(me.user.permissions ?? []);
      setAllowAll(me.user.sessionRole === "SUPER_ADMIN");
    });
  }, []);

  const items = useMemo(() => {
    const workspaceLike = { enabledModules: enabledModuleIds };
    return FINANCE_NAV.filter((item) => {
      const permitted = allowAll || permissions.includes(item.permission);
      return permitted && navHrefAllowed(item.href, workspaceLike, permissions, allowAll);
    });
  }, [enabledModuleIds, permissions, allowAll]);

  return <SectionTabs items={items} rootPath="/finance" />;
}
