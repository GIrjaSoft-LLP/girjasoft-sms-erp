"use client";

import { useEffect, useState } from "react";
import { LetterheadPreview } from "@/components/LetterheadPreview";
import {
  DEFAULT_LETTERHEAD_THEME,
  LETTERHEAD_DESIGNS,
  LETTERHEAD_PALETTES,
  type LetterheadTheme,
  type SchoolBrand,
} from "@/config/theme";
import { api } from "@/lib/client";

export default function ThemeSettingsPage() {
  const [theme, setTheme] = useState<LetterheadTheme>(DEFAULT_LETTERHEAD_THEME);
  const [brand, setBrand] = useState<SchoolBrand>({ schoolName: "" });
  const [canEdit, setCanEdit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ theme: LetterheadTheme; brand: SchoolBrand; canEdit?: boolean }>("/api/settings/theme")
      .then((data) => {
        setTheme(data.theme);
        setBrand(data.brand);
        setCanEdit(Boolean(data.canEdit));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api("/api/settings/theme", { method: "PATCH", body: JSON.stringify(theme) });
      setMessage("Theme saved for this school.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save theme");
    } finally {
      setSaving(false);
    }
  }

  async function download(blank: boolean) {
    setError("");
    try {
      const response = await fetch(`/api/settings/theme/letterhead${blank ? "?blank=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const header = response.headers.get("Content-Disposition") ?? "";
      const match = header.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] || "School_Letterhead.docx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Theme</h2>
        <p className="text-sm text-slate-500">Configure this school’s letterhead design and colours.</p>
      </div>

      <div className="gs-card p-5 space-y-4">
        <h3 className="font-semibold">Select letterhead design</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {LETTERHEAD_DESIGNS.map((design) => {
            const selected = theme.design === design.id;
            return (
              <button
                key={design.id}
                type="button"
                className={`rounded-xl border p-2 text-left ${
                  selected ? "border-[#4c7eff] ring-2 ring-[#4c7eff]/30" : "border-slate-200"
                }`}
                onClick={() => setTheme((current) => ({ ...current, design: design.id }))}
              >
                <LetterheadPreview brand={brand} theme={{ ...theme, design: design.id }} compact />
                <p className="mt-2 text-sm font-medium">
                  {design.name}
                  {selected ? " · Selected" : ""}
                </p>
                <p className="text-xs text-slate-500">{design.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="gs-card p-5 space-y-4">
        <h3 className="font-semibold">Select colour</h3>
        <div className="flex flex-wrap gap-2">
          {LETTERHEAD_PALETTES.map((palette) => (
            <button
              key={palette.name}
              type="button"
              className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm"
              onClick={() =>
                setTheme((current) => ({
                  ...current,
                  primary: palette.primary,
                  secondary: palette.secondary,
                  accent: palette.accent,
                }))
              }
            >
              <span className="h-4 w-4 rounded-full" style={{ background: palette.primary }} />
              {palette.name}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["primary", "Primary colour"],
              ["secondary", "Secondary colour"],
              ["accent", "Accent colour"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded border border-slate-200"
                  value={theme[key]}
                  onChange={(e) => setTheme((current) => ({ ...current, [key]: e.target.value }))}
                />
                <input
                  className="gs-input"
                  value={theme[key]}
                  onChange={(e) => setTheme((current) => ({ ...current, [key]: e.target.value }))}
                />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="gs-card p-5 space-y-3">
        <h3 className="font-semibold">Preview</h3>
        <div className="max-w-3xl overflow-hidden">
          <LetterheadPreview brand={brand} theme={theme} />
        </div>
      </div>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}
      {message ? <p className="text-emerald-700 text-sm">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <button type="button" className="gs-btn px-4 py-2" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save Theme"}
          </button>
        ) : null}
        <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => void download(false)}>
          Download Letterhead
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={() => void download(true)}>
          Download Blank Letterhead
        </button>
      </div>
    </div>
  );
}
