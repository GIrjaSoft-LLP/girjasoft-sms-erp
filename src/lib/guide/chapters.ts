import { ACADEMIC_CHAPTERS } from "@/lib/guide/chapters-academic";
import { CLOSING_CHAPTERS } from "@/lib/guide/chapters-closing";
import { CORE_CHAPTERS } from "@/lib/guide/chapters-core";
import { OPS_CHAPTERS } from "@/lib/guide/chapters-ops";
import { searchHaystack } from "@/lib/guide/format";
import type { GuideChapter } from "@/lib/guide/types";

export const ALL_GUIDE_CHAPTERS: GuideChapter[] = [
  ...CORE_CHAPTERS,
  ...ACADEMIC_CHAPTERS,
  ...OPS_CHAPTERS,
  ...CLOSING_CHAPTERS,
];

export function visibleGuideChapters(enabledModuleIds: string[]) {
  const enabled = new Set(enabledModuleIds);
  return ALL_GUIDE_CHAPTERS.filter((chapter) => !chapter.moduleId || enabled.has(chapter.moduleId));
}

export function searchGuideChapters(chapters: GuideChapter[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  return chapters
    .map((chapter) => {
      const hay = searchHaystack(chapter);
      const hits = words.filter((word) => hay.includes(word)).length;
      return { chapter, hits };
    })
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 12)
    .map((row) => row.chapter);
}

export function detectGuideRole(roleSlugs: string[] = []): import("@/lib/guide/types").GuideRole | null {
  if (roleSlugs.includes("workspace_admin")) return "admin";
  if (roleSlugs.includes("teacher")) return "teacher";
  if (roleSlugs.includes("parent")) return "parent";
  if (roleSlugs.includes("student")) return "student";
  if (roleSlugs.includes("accountant")) return "accountant";
  if (roleSlugs.includes("hr_manager")) return "hr";
  return null;
}
