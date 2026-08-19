"use client";

import { useEffect, useState } from "react";
import { RESOURCE_TO_MODULE } from "@/config/erp-modules";
import { ModuleUnavailable } from "@/components/ModuleUnavailable";
import { api } from "@/lib/client";

export function ModulePageGuard({
  resourceKey,
  children,
}: {
  resourceKey: string;
  children: React.ReactNode;
}) {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[] | null>(null);
  const moduleId = RESOURCE_TO_MODULE[resourceKey] ?? null;

  useEffect(() => {
    api<{ enabledModuleIds: string[] }>("/api/workspace/modules")
      .then((data) => setEnabledModuleIds(data.enabledModuleIds))
      .catch(() => setEnabledModuleIds([]));
  }, []);

  if (enabledModuleIds === null) {
    return <p className="text-sm text-slate-500">Loading module…</p>;
  }

  if (moduleId && !enabledModuleIds.includes(moduleId)) {
    return <ModuleUnavailable moduleId={moduleId} />;
  }

  return children;
}
