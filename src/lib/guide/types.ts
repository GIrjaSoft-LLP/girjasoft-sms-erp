export type GuideRole = "admin" | "teacher" | "parent" | "accountant" | "student" | "hr";

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ol" | "ul" | "steps"; items: string[] }
  | { type: "note" | "tip" | "important" | "warning"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type GuideChapter = {
  id: string;
  title: string;
  moduleId?: string;
  keywords: string[];
  highlightRoles?: GuideRole[];
  blocks: GuideBlock[];
};
