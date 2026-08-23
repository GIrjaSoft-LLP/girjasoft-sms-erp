export const UI_THEME_IDS = ["playful", "elegant", "prestige", "spectrum"] as const;
export type UiThemeId = (typeof UI_THEME_IDS)[number];

export const UI_MODE_IDS = ["light", "dark", "system"] as const;
export type UiModeId = (typeof UI_MODE_IDS)[number];

export type DesignPreferences = {
  theme: UiThemeId;
  mode: UiModeId;
  accentColor: string;
  customized: boolean;
};

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  theme: "elegant",
  mode: "system",
  accentColor: "#4c7eff",
  customized: false,
};

export const ACCENT_PALETTE = [
  { id: "blue", label: "Blue", color: "#4c7eff" },
  { id: "indigo", label: "Indigo", color: "#6366f1" },
  { id: "purple", label: "Purple", color: "#8b5cf6" },
  { id: "violet", label: "Violet", color: "#7c3aed" },
  { id: "cyan", label: "Cyan", color: "#06b6d4" },
  { id: "teal", label: "Teal", color: "#14b8a6" },
  { id: "green", label: "Green", color: "#22c55e" },
  { id: "emerald", label: "Emerald", color: "#10b981" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "rose", label: "Rose", color: "#f43f5e" },
] as const;

export type UiThemeMeta = {
  id: UiThemeId;
  name: string;
  tagline: string;
  emoji: string;
  description: string;
  audience: string;
  preview: {
    sidebar: string;
    header: string;
    card: string;
    accent: string;
    surface: string;
  };
};

export const UI_THEMES: UiThemeMeta[] = [
  {
    id: "playful",
    name: "Playful",
    tagline: "Kids & Primary Schools",
    emoji: "🎨",
    description: "Bright, friendly and energetic — ideal for nursery and primary schools.",
    audience: "Nursery / Primary School",
    preview: {
      sidebar: "linear-gradient(180deg, #5b7cfa 0%, #8b5cf6 100%)",
      header: "#ffffff",
      card: "#ffffff",
      accent: "#7c3aed",
      surface: "#f0f9ff",
    },
  },
  {
    id: "elegant",
    name: "Elegant",
    tagline: "Modern School",
    emoji: "✨",
    description: "Clean, balanced and professional — recommended for most schools.",
    audience: "School / Senior Secondary",
    preview: {
      sidebar: "linear-gradient(180deg, #0b1b3a 0%, #12284f 100%)",
      header: "#ffffff",
      card: "#ffffff",
      accent: "#4c7eff",
      surface: "#f3f6fb",
    },
  },
  {
    id: "prestige",
    name: "Prestige",
    tagline: "Premium Institution",
    emoji: "🏛",
    description: "Sophisticated and minimal — suited for colleges and large institutions.",
    audience: "College / University",
    preview: {
      sidebar: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
      header: "#fafafa",
      card: "#ffffff",
      accent: "#059669",
      surface: "#f8fafc",
    },
  },
  {
    id: "spectrum",
    name: "Spectrum",
    tagline: "Vibrant & Modern",
    emoji: "⚡",
    description: "Modern gradients and vibrant accents for technology-forward campuses.",
    audience: "Modern / Tech-forward",
    preview: {
      sidebar: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0e7490 100%)",
      header: "rgba(255,255,255,0.85)",
      card: "rgba(255,255,255,0.92)",
      accent: "#06b6d4",
      surface: "#eef2ff",
    },
  },
];

export const INSTITUTION_THEME_RECOMMENDATIONS: Record<string, UiThemeId> = {
  nursery: "playful",
  primary: "playful",
  school: "elegant",
  secondary: "elegant",
  senior_secondary: "prestige",
  college: "prestige",
  university: "prestige",
};

export function normalizeDesignPreferences(input?: Partial<DesignPreferences> | null): DesignPreferences {
  const theme = UI_THEME_IDS.includes(input?.theme as UiThemeId) ? (input!.theme as UiThemeId) : DEFAULT_DESIGN_PREFERENCES.theme;
  const mode = UI_MODE_IDS.includes(input?.mode as UiModeId) ? (input!.mode as UiModeId) : DEFAULT_DESIGN_PREFERENCES.mode;
  const accentColor =
    typeof input?.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accentColor)
      ? input.accentColor
      : DEFAULT_DESIGN_PREFERENCES.accentColor;
  return {
    theme,
    mode,
    accentColor,
    customized: Boolean(input?.customized),
  };
}

export function resolveEffectiveMode(mode: UiModeId): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export const DESIGN_STORAGE_KEY = "gs-design-preferences";
