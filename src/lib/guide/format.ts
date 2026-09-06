import type { GuideBlock, GuideChapter, GuideRole } from "@/lib/guide/types";

export function moduleDoc(input: {
  id: string;
  title: string;
  moduleId?: string;
  keywords: string[];
  highlightRoles?: GuideRole[];
  purpose: string;
  does: string;
  who: string;
  features: string[];
  open: string;
  workflow: string[];
  create: string;
  edit: string;
  view: string;
  search: string;
  exportPrint: string;
  roles: string[][];
  example: string;
  mistakes: string[];
  practices: string[];
  related: string;
  extra?: GuideBlock[];
}): GuideChapter {
  return {
    id: input.id,
    title: input.title,
    moduleId: input.moduleId,
    keywords: input.keywords,
    highlightRoles: input.highlightRoles,
    blocks: [
      { type: "h", text: "1. Purpose" },
      { type: "p", text: input.purpose },
      { type: "h", text: "2. What this module does" },
      { type: "p", text: input.does },
      { type: "h", text: "3. Who can access it" },
      { type: "p", text: input.who },
      { type: "h", text: "4. Key features" },
      { type: "ul", items: input.features },
      { type: "h", text: "5. How to open the module" },
      { type: "p", text: input.open },
      { type: "h", text: "6. Step-by-step workflow" },
      { type: "steps", items: input.workflow },
      { type: "h", text: "7. How to create / add a record" },
      { type: "p", text: input.create },
      { type: "h", text: "8. How to edit a record" },
      { type: "p", text: input.edit },
      { type: "h", text: "9. How to view a record" },
      { type: "p", text: input.view },
      { type: "h", text: "10. How to search / filter" },
      { type: "p", text: input.search },
      { type: "h", text: "11. How to export / print" },
      { type: "p", text: input.exportPrint },
      { type: "h", text: "12. Role-wise permissions" },
      {
        type: "table",
        headers: ["Function", "Workspace Admin", "Teacher", "Parent / Student"],
        rows: input.roles,
      },
      { type: "h", text: "13. Example workflow" },
      { type: "p", text: input.example },
      { type: "h", text: "14. Common mistakes" },
      { type: "ul", items: input.mistakes },
      { type: "h", text: "15. Best practices" },
      { type: "ul", items: input.practices },
      { type: "h", text: "16. Related modules" },
      { type: "p", text: input.related },
      ...(input.extra ?? []),
    ],
  };
}

export function searchHaystack(chapter: GuideChapter) {
  const parts = [chapter.title, ...chapter.keywords];
  for (const block of chapter.blocks) {
    if ("text" in block && block.text) parts.push(block.text);
    if ("items" in block && block.items) parts.push(...block.items);
    if (block.type === "table") {
      parts.push(...block.headers, ...block.rows.flat());
    }
  }
  return parts.join(" ").toLowerCase();
}
