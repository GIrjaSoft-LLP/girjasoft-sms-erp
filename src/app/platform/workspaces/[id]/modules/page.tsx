"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ERP_MODULE_MAP, getAllAvailableModuleIds } from "@/config/erp-modules";
import { validateModuleDisable } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

type ModuleRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  isCore: boolean;
  status: string;
  dependencies: string[];
  enabled: boolean;
};

export default function WorkspaceModulesPage() {
  const params = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState({ schoolName: "", code: "" });
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [initialEnabledIds, setInitialEnabledIds] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [data, me] = await Promise.all([
      api<{ workspace: { schoolName: string; code: string }; modules: ModuleRow[] }>(
        `/api/platform/workspaces/${params.id}/modules`,
      ),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ]);
    setWorkspace(data.workspace);
    setModules(data.modules);
    setInitialEnabledIds(data.modules.filter((module) => module.enabled).map((module) => module.id));
    setCanEdit((me.user.permissions ?? []).includes("platform.workspaces.edit"));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [params.id]);

  const enabledIds = useMemo(() => modules.filter((module) => module.enabled).map((module) => module.id), [modules]);

  function toggleModule(moduleId: string) {
    setModules((current) =>
      current.map((module) => (module.id === moduleId ? { ...module, enabled: !module.enabled } : module)),
    );
    setError("");
  }

  function enableAllModules() {
    const allAvailable = new Set(getAllAvailableModuleIds());
    setModules((current) =>
      current.map((module) => ({
        ...module,
        enabled: allAvailable.has(module.id) || module.status === "coming_soon" ? true : module.enabled,
      })),
    );
    setError("");
  }

  function disableAllOptional() {
    setModules((current) =>
      current.map((module) =>
        module.isCore || module.status !== "available" ? module : { ...module, enabled: false },
      ),
    );
    setError("");
  }

  async function save() {
    setError("");
    setMessage("");
    const nextEnabled = modules
      .filter((module) => module.enabled && module.status === "available")
      .map((module) => module.id);
    for (const module of modules) {
      if (module.status !== "available" || module.enabled) continue;
      if (!initialEnabledIds.includes(module.id)) continue;
      const check = validateModuleDisable(module.id, nextEnabled);
      if (!check.ok) {
        setError(check.message ?? "Invalid module configuration.");
        return;
      }
    }
    try {
      await api(`/api/platform/workspaces/${params.id}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: nextEnabled }),
      });
      setMessage("Module configuration saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/platform/workspaces/${params.id}/edit`} className="text-sm text-[#4c7eff]">
            ← Workspace
          </Link>
          <h1 className="text-2xl font-semibold text-[#0b1b3a]">{workspace.schoolName}</h1>
          <p className="text-sm text-slate-500">Module Configuration · {workspace.code}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={enableAllModules}>
              Enable All
            </button>
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={disableAllOptional}>
              Disable Optional
            </button>
            <button type="button" className="gs-btn px-4 py-2" onClick={() => void save()}>
              Save Changes
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <div className="gs-card divide-y divide-slate-100">
        {modules.map((module) => (
          <div key={module.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-[#0b1b3a]">
                {module.name}
                {module.status === "coming_soon" ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Coming Soon</span>
                ) : null}
                {module.isCore ? (
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">Core</span>
                ) : null}
              </p>
              <p className="text-slate-500">{module.description}</p>
              {module.dependencies.length ? (
                <p className="mt-1 text-xs text-slate-400">
                  Depends on: {module.dependencies.map((id) => ERP_MODULE_MAP[id]?.name ?? id).join(", ")}
                </p>
              ) : null}
            </div>
            {canEdit && module.status === "available" ? (
              <button
                type="button"
                className={`relative h-7 w-12 rounded-full transition ${module.enabled ? "bg-[#4c7eff]" : "bg-slate-300"} ${module.isCore ? "opacity-60" : ""}`}
                disabled={module.isCore}
                onClick={() => !module.isCore && toggleModule(module.id)}
                aria-label={`Toggle ${module.name}`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${module.enabled ? "left-5" : "left-0.5"}`}
                />
              </button>
            ) : (
              <span className={`text-xs font-semibold ${module.enabled ? "text-emerald-700" : "text-slate-500"}`}>
                {module.enabled ? "Enabled" : "Disabled"}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        All modules are enabled by default. Core modules cannot be disabled. Disabling a module hides access but does not delete data.
      </p>
    </div>
  );
}
