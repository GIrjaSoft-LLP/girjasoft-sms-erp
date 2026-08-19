"use client";

import Link from "next/link";
import { ERP_MODULE_MAP } from "@/config/erp-modules";

export function ModuleUnavailable({ moduleId }: { moduleId?: string | null }) {
  const module = moduleId ? ERP_MODULE_MAP[moduleId] : null;
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <div className="gs-card p-8">
        <h1 className="text-xl font-semibold text-[#0b1b3a]">Module Not Available</h1>
        <p className="mt-3 text-sm text-slate-600">
          {module
            ? `The ${module.name} module is currently not enabled for your school.`
            : "This module is currently not enabled for your school."}
        </p>
        <p className="mt-2 text-sm text-slate-500">Please contact your administrator.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-[#4c7eff] underline">
          Back to ERP Modules
        </Link>
      </div>
    </div>
  );
}
