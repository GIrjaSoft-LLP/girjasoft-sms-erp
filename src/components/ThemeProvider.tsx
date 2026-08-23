"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DESIGN_PREFERENCES,
  type DesignPreferences,
  type UiThemeId,
} from "@/config/ui-theme";
import {
  applyDesignPreferences,
  loadDesignPreferencesLocal,
  mergeDesignPreferences,
  saveDesignPreferencesLocal,
} from "@/lib/design-preferences";
import { api } from "@/lib/client";

type ThemeContextValue = {
  preferences: DesignPreferences;
  recommendedTheme: UiThemeId | null;
  loading: boolean;
  preview: (prefs: DesignPreferences) => void;
  apply: (prefs: DesignPreferences) => Promise<void>;
  resetPreview: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<DesignPreferences>(DEFAULT_DESIGN_PREFERENCES);
  const [recommendedTheme, setRecommendedTheme] = useState<UiThemeId | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSnapshot, setSavedSnapshot] = useState<DesignPreferences>(DEFAULT_DESIGN_PREFERENCES);

  const sync = useCallback((prefs: DesignPreferences) => {
    setPreferences(prefs);
    saveDesignPreferencesLocal(prefs);
  }, []);

  useEffect(() => {
    const local = loadDesignPreferencesLocal();
    if (local) applyDesignPreferences(local);

    api<{ preferences: DesignPreferences; recommendedTheme?: UiThemeId | null }>("/api/profile/design")
      .then((data) => {
        const merged = mergeDesignPreferences(data.preferences, data.recommendedTheme ?? null);
        setRecommendedTheme(data.recommendedTheme ?? null);
        setPreferences(merged);
        setSavedSnapshot(merged);
        sync(merged);
      })
      .catch(() => {
        const fallback = local ?? DEFAULT_DESIGN_PREFERENCES;
        setPreferences(fallback);
        setSavedSnapshot(fallback);
        if (local) applyDesignPreferences(local);
      })
      .finally(() => setLoading(false));
  }, [sync]);

  useEffect(() => {
    if (preferences.mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDesignPreferences(preferences);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preferences]);

  const preview = useCallback((prefs: DesignPreferences) => {
    applyDesignPreferences(prefs);
  }, []);

  const resetPreview = useCallback(() => {
    applyDesignPreferences(savedSnapshot);
    setPreferences(savedSnapshot);
  }, [savedSnapshot]);

  const apply = useCallback(
    async (prefs: DesignPreferences) => {
      const payload = { ...prefs, customized: true };
      const data = await api<{ preferences: DesignPreferences }>("/api/profile/design", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const next = data.preferences;
      setPreferences(next);
      setSavedSnapshot(next);
      sync(next);
    },
    [sync],
  );

  const value = useMemo(
    () => ({ preferences, recommendedTheme, loading, preview, apply, resetPreview }),
    [apply, loading, preferences, preview, recommendedTheme, resetPreview],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreferences() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemePreferences must be used within ThemeProvider");
  return ctx;
}
