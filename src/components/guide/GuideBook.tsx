"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_NAME, APP_TAGLINE, APP_VERSION, COMPANY_NAME } from "@/config/branding";
import { detectGuideRole, searchGuideChapters, visibleGuideChapters } from "@/lib/guide/chapters";
import type { GuideBlock, GuideChapter, GuideRole } from "@/lib/guide/types";
import { api } from "@/lib/client";

const ROLE_LABEL: Record<GuideRole, string> = {
  admin: "Workspace Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  accountant: "Accountant",
  hr: "HR Manager",
};

function Callout({ kind, text }: { kind: "note" | "tip" | "important" | "warning"; text: string }) {
  const styles = {
    note: "border-slate-200 bg-slate-50 text-slate-700",
    tip: "border-emerald-200 bg-emerald-50 text-emerald-900",
    important: "border-amber-200 bg-amber-50 text-amber-950",
    warning: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${styles[kind]}`}>
      <strong className="mr-1 uppercase">{kind}.</strong>
      {text}
    </p>
  );
}

function Blocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="guide-prose space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "p") return <p key={index}>{block.text}</p>;
        if (block.type === "h") return <h3 key={index}>{block.text}</h3>;
        if (block.type === "ul") {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "steps") {
          return (
            <ol key={index} className="guide-steps">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "table") {
          return (
            <div key={index} className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    {block.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.join("|")}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <Callout key={index} kind={block.type} text={block.text} />;
      })}
    </div>
  );
}

export function GuideBook() {
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [role, setRole] = useState<GuideRole | null>(null);
  const [activeId, setActiveId] = useState("introduction");
  const [query, setQuery] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
      api<{ user: { roleSlugs?: string[] } }>("/api/auth/me"),
    ])
      .then(([modules, me]) => {
        setEnabledModuleIds(modules.enabledModuleIds ?? []);
        setRole(detectGuideRole(me.user.roleSlugs));
      })
      .catch(() => setEnabledModuleIds([]))
      .finally(() => setReady(true));
  }, []);

  const chapters = useMemo(() => visibleGuideChapters(enabledModuleIds), [enabledModuleIds]);
  const active = chapters.find((chapter) => chapter.id === activeId) ?? chapters[0];
  const activeIndex = Math.max(0, chapters.findIndex((chapter) => chapter.id === active?.id));
  const results = useMemo(() => searchGuideChapters(chapters, query), [chapters, query]);

  useEffect(() => {
    if (!chapters.length) return;
    if (!chapters.some((chapter) => chapter.id === activeId)) {
      setActiveId(chapters[0].id);
    }
  }, [chapters, activeId]);

  function openChapter(id: string) {
    setActiveId(id);
    setTocOpen(false);
    setQuery("");
  }

  const previous = chapters[activeIndex - 1];
  const next = chapters[activeIndex + 1];

  return (
    <div className="guide-book">
      <header className="guide-book-hero print:break-after-page">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User Manual · SOP · Training Guide</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0b1b3a] md:text-3xl">{APP_NAME} Guide</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete User Guide &amp; Standard Operating Procedure · {APP_TAGLINE}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Document purpose: operational guide for school staff and parents. Version {APP_VERSION.replace(/^v/i, "")} · {COMPANY_NAME}
        </p>
        {role ? (
          <p className="mt-3 inline-flex rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#1e3a8a]">
            Your role: {ROLE_LABEL[role]}
            {active?.highlightRoles?.includes(role) ? " · this chapter is especially for you" : ""}
          </p>
        ) : null}
        <label className="mt-4 block">
          <span className="sr-only">Search the Guide</span>
          <input
            className="gs-input w-full md:max-w-lg"
            placeholder="Search the Guide..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {query.trim() && results.length ? (
          <ul className="mt-2 max-w-lg divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {results.map((chapter) => (
              <li key={chapter.id}>
                <button type="button" className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => openChapter(chapter.id)}>
                  {chapter.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {query.trim() && !results.length ? <p className="mt-2 text-sm text-slate-500">No matching chapters.</p> : null}
      </header>

      <div className="guide-book-layout">
        <div className="guide-toc-mobile print:hidden">
          <button type="button" className="gs-btn px-3 py-2" onClick={() => setTocOpen((open) => !open)}>
            ☰ Contents
          </button>
        </div>
        <aside className={`guide-toc ${tocOpen ? "is-open" : ""}`}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contents</p>
          <nav className="space-y-0.5">
            {ready
              ? chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    type="button"
                    className={`guide-toc-item ${chapter.id === active?.id ? "is-active" : ""}`}
                    onClick={() => openChapter(chapter.id)}
                  >
                    <span className="guide-toc-num">{index + 1}</span>
                    {chapter.title}
                  </button>
                ))
              : <p className="text-sm text-slate-500">Loading contents…</p>}
          </nav>
        </aside>
        {tocOpen ? (
          <button type="button" className="guide-toc-backdrop print:hidden" aria-label="Close contents" onClick={() => setTocOpen(false)} />
        ) : null}

        <article className="guide-content">
          {!ready || !active ? (
            <p className="text-sm text-slate-500">Opening the guide…</p>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Chapter {activeIndex + 1} of {chapters.length}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#0b1b3a] md:text-2xl">{active.title}</h2>
              <Blocks blocks={active.blocks} />
              <div className="guide-pager print:hidden">
                <button type="button" className="guide-pager-btn" disabled={!previous} onClick={() => previous && openChapter(previous.id)}>
                  ← Previous{previous ? `: ${previous.title}` : ""}
                </button>
                <button type="button" className="guide-pager-btn" disabled={!next} onClick={() => next && openChapter(next.id)}>
                  {next ? `${next.title} ` : ""}Next →
                </button>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
