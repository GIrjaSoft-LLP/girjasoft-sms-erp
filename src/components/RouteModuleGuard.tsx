"use client";

import { useEffect, useState } from "react";
import { moduleForPathname } from "@/lib/workspace-modules";
import { ModuleUnavailable } from "@/components/ModuleUnavailable";
import { api } from "@/lib/client";
import { usePathname } from "next/navigation";

export function RouteModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[] | null>(null);
  const moduleId = moduleForPathname(pathname);

  useEffect(() => {
    api<{ enabledModuleIds: string[] }>("/api/workspace/modules")
      .then((data) => setEnabledModuleIds(data.enabledModuleIds))
      .catch(() => setEnabledModuleIds([]));
  }, []);

  if (!moduleId) return children;
  if (enabledModuleIds === null) return <p className="text-sm text-slate-500">Loading module…</p>;
  if (!enabledModuleIds.includes(moduleId)) return <ModuleUnavailable moduleId={moduleId} />;
  return children;
}
