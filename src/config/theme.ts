export const LETTERHEAD_DESIGNS = [
  { id: "classic", name: "Classic Professional", description: "Centered logo, horizontal header and footer" },
  { id: "sidebar", name: "Modern Sidebar", description: "Vertical colour strip with logo" },
  { id: "elegant", name: "Elegant Centered", description: "Formal centered layout for notices" },
  { id: "corporate", name: "Corporate School", description: "Logo left, structured title band" },
] as const;

export type LetterheadDesignId = (typeof LETTERHEAD_DESIGNS)[number]["id"];

export type LetterheadTheme = {
  design: LetterheadDesignId;
  primary: string;
  secondary: string;
  accent: string;
};

export const DEFAULT_LETTERHEAD_THEME: LetterheadTheme = {
  design: "classic",
  primary: "#4c7eff",
  secondary: "#0b1b3a",
  accent: "#42a5f5",
};

export const LETTERHEAD_PALETTES: Array<{ name: string } & Omit<LetterheadTheme, "design">> = [
  { name: "Blue", primary: "#4c7eff", secondary: "#0b1b3a", accent: "#42a5f5" },
  { name: "Navy", primary: "#12284f", secondary: "#0b1b3a", accent: "#4c7eff" },
  { name: "Green", primary: "#1b7a4e", secondary: "#0f3d28", accent: "#3cb371" },
  { name: "Maroon", primary: "#7a1f2b", secondary: "#3d1016", accent: "#c45c5c" },
  { name: "Purple", primary: "#5b3cc4", secondary: "#2a1a5c", accent: "#9b8cff" },
  { name: "Orange", primary: "#d97706", secondary: "#7c3d00", accent: "#fbbf24" },
  { name: "Teal", primary: "#0f766e", secondary: "#134e4a", accent: "#2dd4bf" },
  { name: "Red", primary: "#b91c1c", secondary: "#7f1d1d", accent: "#f87171" },
];

export function isLetterheadDesign(value: string): value is LetterheadDesignId {
  return LETTERHEAD_DESIGNS.some((item) => item.id === value);
}

export function normalizeHex(value: string, fallback: string) {
  const hex = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(hex) ? hex.toLowerCase() : fallback;
}

export function normalizeLetterheadTheme(input: unknown): LetterheadTheme {
  const row = (input ?? {}) as Partial<LetterheadTheme>;
  return {
    design: isLetterheadDesign(String(row.design ?? "")) ? (row.design as LetterheadDesignId) : DEFAULT_LETTERHEAD_THEME.design,
    primary: normalizeHex(String(row.primary ?? ""), DEFAULT_LETTERHEAD_THEME.primary),
    secondary: normalizeHex(String(row.secondary ?? ""), DEFAULT_LETTERHEAD_THEME.secondary),
    accent: normalizeHex(String(row.accent ?? ""), DEFAULT_LETTERHEAD_THEME.accent),
  };
}

export type SchoolBrand = {
  schoolName: string;
  logo?: string;
  tagline?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  code?: string;
};

export function schoolContactLine(brand: SchoolBrand) {
  const location = [brand.address, brand.city, brand.state, brand.pinCode].filter(Boolean).join(", ");
  return [location, brand.phone, brand.email, brand.website].filter(Boolean).join("  |  ");
}

export function brandFromWorkspace(
  workspace: Record<string, unknown> | null | undefined,
  organization: Record<string, unknown> = {},
): SchoolBrand {
  return {
    schoolName: String(workspace?.schoolName ?? workspace?.name ?? ""),
    logo: String(workspace?.logo || organization.logo || ""),
    tagline: String(organization.tagline || workspace?.academicSession || ""),
    address: String(workspace?.address ?? ""),
    city: String(workspace?.city ?? ""),
    state: String(workspace?.state ?? ""),
    pinCode: String(workspace?.pinCode ?? ""),
    phone: String(workspace?.phone ?? ""),
    email: String(workspace?.email ?? ""),
    website: String(workspace?.website ?? ""),
    code: String(workspace?.code ?? ""),
  };
}
