"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FINANCE_NAV } from "@/config/nav";
import { navHrefAllowed } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

export default function FinanceIndexPage() {
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      api<{ user: { permissions?: string[]; sessionRole?: string } }>("/api/auth/me"),
      api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
    ])
      .then(([data, modules]) => {
        const perms = data.user.permissions ?? [];
        const allowAll = data.user.sessionRole === "SUPER_ADMIN";
        const workspaceLike = { enabledModules: modules.enabledModuleIds };
        const first = FINANCE_NAV.find(
          (item) =>
            (allowAll || perms.includes(item.permission)) &&
            navHrefAllowed(item.href, workspaceLike, perms, allowAll),
        );
        router.replace(first?.href ?? "/dashboard");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  return <p className="text-slate-500">Opening Finance…</p>;
}
