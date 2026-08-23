"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACCENT_PALETTE,
  UI_THEMES,
  type DesignPreferences,
  type UiModeId,
  type UiThemeId,
  normalizeDesignPreferences,
  resolveEffectiveMode,
} from "@/config/ui-theme";
import { useThemePreferences } from "@/components/ThemeProvider";

const UI_MODES = [
  { id: "light" as UiModeId, label: "Light" },
  { id: "dark" as UiModeId, label: "Dark" },
  { id: "system" as UiModeId, label: "System Default" },
];

function MiniPreview({ preferences }: { preferences: DesignPreferences }) {
  return (
    <div
      className="overflow-hidden rounded-xl border gs-border"
      data-theme={preferences.theme}
      data-mode={resolveEffectiveMode(preferences.mode)}
      style={{ ["--accent" as string]: preferences.accentColor, ["--primary" as string]: preferences.accentColor }}
    >
      <div className="flex h-28">
        <div className="w-1/3 gs-sidebar-preview p-2 text-[10px] text-white">
          <div className="mb-2 h-2 w-8 rounded bg-white/30" />
          <div className="space-y-1">
            <div className="h-2 rounded gs-nav-active-preview" />
            <div className="h-2 rounded bg-white/15" />
            <div className="h-2 rounded bg-white/15" />
          </div>
        </div>
        <div className="flex-1 gs-surface-preview p-2">
          <div className="mb-2 h-3 rounded gs-header-preview" />
          <div className="grid grid-cols-2 gap-1">
            <div className="h-8 rounded gs-card-preview" />
            <div className="h-8 rounded gs-card-preview" />
          </div>
          <div className="mt-2 h-4 w-12 rounded gs-btn-preview" />
        </div>
      </div>
    </div>
  );
}

export function DesignPreferencesPanel() {
  const { preferences, recommendedTheme, loading, preview, apply, resetPreview } = useThemePreferences();
  const [draft, setDraft] = useState<DesignPreferences>(preferences);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const themeMeta = useMemo(() => UI_THEMES.find((row) => row.id === draft.theme), [draft.theme]);

  function updateDraft(patch: Partial<DesignPreferences>) {
    const next = normalizeDesignPreferences({ ...draft, ...patch });
    setDraft(next);
    if (previewing) preview(next);
  }

  async function handleApply() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apply({ ...draft, customized: true });
      setPreviewing(false);
      setMessage("Design applied successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save design.");
      resetPreview();
    } finally {
      setSaving(false);
    }
  }

  function handlePreview() {
    setPreviewing(true);
    preview(draft);
    setMessage("Preview active — click Apply Design to save.");
  }

  if (loading) {
    return <p className="text-sm gs-muted">Loading appearance settings…</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold gs-heading">Appearance</h2>
        <p className="mt-1 text-sm gs-muted">
          Personalize how the portal looks. Your choice applies across the entire ERP.
          {recommendedTheme ? (
            <span> Institution recommends: <strong className="capitalize">{recommendedTheme}</strong>.</span>
          ) : null}
        </p>
      </div>

      <div className="gs-card p-5 space-y-4">
        <h3 className="font-semibold gs-heading">Theme</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {UI_THEMES.map((theme) => (
            <label
              key={theme.id}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                draft.theme === theme.id ? "gs-theme-card-active" : "gs-theme-card"
              }`}
            >
              <input
                type="radio"
                name="theme"
                className="sr-only"
                checked={draft.theme === theme.id}
                onChange={() => updateDraft({ theme: theme.id as UiThemeId })}
              />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold gs-heading">
                    {theme.emoji} {theme.name}
                  </p>
                  <p className="text-xs gs-muted">{theme.tagline}</p>
                </div>
                {recommendedTheme === theme.id ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs gs-muted">{theme.description}</p>
              <div
                className="mt-3 h-16 rounded-lg border"
                style={{
                  background: theme.preview.sidebar,
                  borderColor: "var(--border)",
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="gs-card p-5 space-y-3">
        <h3 className="font-semibold gs-heading">Mode</h3>
        <div className="flex flex-wrap gap-4">
          {UI_MODES.map((mode) => (
            <label key={mode.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={draft.mode === mode.id}
                onChange={() => updateDraft({ mode: mode.id })}
              />
              {mode.label}
            </label>
          ))}
        </div>
      </div>

      <div className="gs-card p-5 space-y-3">
        <h3 className="font-semibold gs-heading">Accent Color</h3>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PALETTE.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              title={swatch.label}
              className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                draft.accentColor.toLowerCase() === swatch.color.toLowerCase() ? "border-[var(--foreground)]" : "border-transparent"
              }`}
              style={{ backgroundColor: swatch.color }}
              onClick={() => updateDraft({ accentColor: swatch.color })}
            />
          ))}
        </div>
        <label className="block text-sm">
          Custom color
          <input
            type="color"
            className="mt-1 h-10 w-full max-w-[120px] cursor-pointer rounded-lg border gs-border bg-transparent"
            value={draft.accentColor}
            onChange={(e) => updateDraft({ accentColor: e.target.value })}
          />
        </label>
      </div>

      <div className="gs-card p-5 space-y-3">
        <h3 className="font-semibold gs-heading">Preview — {themeMeta?.name ?? draft.theme}</h3>
        <MiniPreview preferences={draft} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border px-4 py-2 text-sm gs-tab" onClick={handlePreview}>
          Preview
        </button>
        <button type="button" className="gs-btn px-4 py-2" disabled={saving} onClick={() => void handleApply()}>
          {saving ? "Applying…" : "Apply Design"}
        </button>
        {previewing ? (
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm gs-tab"
            onClick={() => {
              setPreviewing(false);
              resetPreview();
              setDraft(preferences);
              setMessage("");
            }}
          >
            Cancel Preview
          </button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
