"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ModuleCard = {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  category: string;
  accent: string;
};

export function ModuleHomepage({ modules }: { modules: ModuleCard[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return modules;
    return modules.filter(
      (module) =>
        module.name.toLowerCase().includes(term) ||
        module.description.toLowerCase().includes(term) ||
        module.category.toLowerCase().includes(term),
    );
  }, [modules, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold gs-heading">Comprehensive Feature Ecosystem</h1>
          <p className="mt-1 text-sm gs-muted">
            Select a module to access and manage your school operations.
          </p>
        </div>
        <label className="min-w-[220px] flex-1 text-sm sm:max-w-xs">
          <span className="sr-only">Search modules</span>
          <input
            className="gs-input"
            placeholder="Search modules..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {filtered.map((module) => (
            <Link
              key={module.id}
              href={module.route}
              className="group gs-card p-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: `linear-gradient(180deg, color-mix(in srgb, ${module.accent} 18%, var(--surface)) 0%, var(--surface) 100%)`,
                outlineColor: "var(--accent)",
              }}
            >
              <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                  {module.icon}
                </div>
                <h2 className="text-sm font-semibold gs-heading group-hover:text-[var(--accent)]">{module.name}</h2>
                <p className="mt-2 line-clamp-2 text-xs gs-muted">{module.description}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : modules.length ? (
        <div className="gs-card p-8 text-center text-sm text-slate-500">No modules match your search.</div>
      ) : (
        <div className="gs-card p-8 text-center">
          <h2 className="text-lg font-semibold text-[#0b1b3a]">No Modules Available</h2>
          <p className="mt-2 text-sm text-slate-500">
            No ERP modules are currently enabled for your school. Please contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
}
