import {
  DEFAULT_DESIGN_PREFERENCES,
  DESIGN_STORAGE_KEY,
  type DesignPreferences,
  normalizeDesignPreferences,
  resolveEffectiveMode,
  type UiThemeId,
} from "@/config/ui-theme";

export function applyDesignPreferences(preferences: DesignPreferences) {
  if (typeof document === "undefined") return;
  const normalized = normalizeDesignPreferences(preferences);
  const root = document.documentElement;
  root.setAttribute("data-theme", normalized.theme);
  root.setAttribute("data-mode", resolveEffectiveMode(normalized.mode));
  root.style.setProperty("--accent", normalized.accentColor);
  root.style.setProperty("--primary", normalized.accentColor);
}

export function saveDesignPreferencesLocal(preferences: DesignPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(normalizeDesignPreferences(preferences)));
  applyDesignPreferences(preferences);
}

export function loadDesignPreferencesLocal(): DesignPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
    if (!raw) return null;
    return normalizeDesignPreferences(JSON.parse(raw) as Partial<DesignPreferences>);
  } catch {
    return null;
  }
}

export function mergeDesignPreferences(
  userPrefs: Partial<DesignPreferences> | null | undefined,
  workspaceRecommended?: UiThemeId | null,
): DesignPreferences {
  const base = normalizeDesignPreferences(userPrefs);
  if (!base.customized && workspaceRecommended) {
    return { ...base, theme: workspaceRecommended };
  }
  if (!base.customized && !userPrefs?.theme) {
    return { ...DEFAULT_DESIGN_PREFERENCES, mode: base.mode, accentColor: base.accentColor };
  }
  return base;
}

export function designPreferencesFromDb(value: unknown): DesignPreferences | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<DesignPreferences>;
  if (!row.theme && !row.mode && !row.accentColor) return null;
  return normalizeDesignPreferences(row);
}
