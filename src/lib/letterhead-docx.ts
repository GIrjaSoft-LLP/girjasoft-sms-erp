import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { LetterheadTheme, SchoolBrand } from "@/config/theme";
import { schoolContactLine } from "@/config/theme";

const A4 = { width: 11906, height: 16838 };
const PAGE_W = 10706;

function hex(value: string) {
  return value.replace("#", "").toUpperCase();
}

function noBorder() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function cell(
  children: Paragraph[],
  opts: { width: number; fill?: string; borders?: ReturnType<typeof noBorder>; align?: typeof VerticalAlign.CENTER } = {
    width: PAGE_W,
  },
) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: hex(opts.fill) } : undefined,
    borders: opts.borders ?? noBorder(),
    verticalAlign: opts.align ?? VerticalAlign.CENTER,
    children,
  });
}

function line(text: string, opts: { color?: string; size?: number; bold?: boolean; italic?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: opts.size ?? 20,
        bold: opts.bold,
        italics: opts.italic,
        color: hex(opts.color ?? "0B1B3A"),
      }),
    ],
  });
}

async function logoRun(brand: SchoolBrand) {
  const raw = (brand.logo ?? "").split("?")[0];
  if (!raw.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "public", raw.replace(/^\/+/, ""));
  const relative = path.relative(path.join(process.cwd(), "public", "uploads"), filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === ".jpg" || ext === ".jpeg" ? "jpg" : ext === ".gif" ? "gif" : "png";
    if (ext === ".webp") return null;
    return new ImageRun({
      type,
      data,
      transformation: { width: 72, height: 72 },
      altText: { title: brand.schoolName, description: "School logo", name: "logo" },
    });
  } catch {
    return null;
  }
}

function logoParagraph(
  image: ImageRun | null,
  brand: SchoolBrand,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER,
) {
  if (image) {
    return new Paragraph({ alignment: align, spacing: { after: 80 }, children: [image] });
  }
  const letters =
    brand.schoolName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "LOGO";
  return line(letters, { bold: true, size: 28, color: "64748B", align });
}

function bodyParagraphs(blank: boolean, primary: string) {
  const title = blank ? "" : "Official Correspondence";
  const hint = "Write your document here.";
  return [
    new Paragraph({ spacing: { before: 200, after: 120 }, children: title ? [new TextRun({ text: title, bold: true, size: 28, font: "Calibri", color: hex(primary) })] : [] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: hint, italics: true, color: "94A3B8", size: 22, font: "Calibri" })] }),
    ...Array.from({ length: blank ? 14 : 10 }, () => new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "" })] })),
  ];
}

export async function buildLetterheadDocx(brand: SchoolBrand, theme: LetterheadTheme, blank: boolean) {
  const image = await logoRun(brand);
  const contact = schoolContactLine(brand) || " ";
  const tagline = brand.tagline || "Official School Letterhead";
  const name = brand.schoolName || "School Name";

  const headerChildren: Array<Table | Paragraph> = [];
  const footerChildren: Array<Table | Paragraph> = [];

  if (theme.design === "sidebar") {
    headerChildren.push(
      new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        rows: [
          new TableRow({
            height: { value: 1600, rule: HeightRule.ATLEAST },
            children: [
              cell([logoParagraph(image, brand), line(brand.code || "", { color: "FFFFFF", size: 16 })], {
                width: 2200,
                fill: theme.primary,
              }),
              cell(
                [
                  line(name, { bold: true, size: 32, color: theme.secondary, align: AlignmentType.LEFT }),
                  line(tagline, { size: 18, color: theme.primary, italic: true, align: AlignmentType.LEFT }),
                  line(contact, { size: 16, color: "475569", align: AlignmentType.LEFT }),
                ],
                { width: 8506 },
              ),
            ],
          }),
        ],
      }),
    );
    footerChildren.push(line(contact, { size: 16, color: theme.secondary }));
  } else if (theme.design === "elegant") {
    headerChildren.push(
      logoParagraph(image, brand),
      line(name, { bold: true, size: 36, color: theme.secondary }),
      line(tagline, { italic: true, size: 20, color: theme.primary }),
      line(contact, { size: 16, color: "475569" }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(theme.accent), space: 8 } },
        children: [new TextRun("")],
      }),
    );
    footerChildren.push(
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: hex(theme.primary), space: 8 } },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contact, size: 16, color: hex(theme.secondary), font: "Calibri" })],
      }),
    );
  } else if (theme.design === "corporate") {
    headerChildren.push(
      new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              cell([logoParagraph(image, brand, AlignmentType.LEFT)], { width: 1800, fill: theme.secondary }),
              cell(
                [
                  line(name, { bold: true, size: 32, color: "FFFFFF", align: AlignmentType.LEFT }),
                  line(tagline, { size: 18, color: theme.accent, align: AlignmentType.LEFT }),
                ],
                { width: 8906, fill: theme.secondary },
              ),
            ],
          }),
        ],
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: hex(theme.primary), space: 1 } },
        children: [new TextRun("")],
      }),
    );
    footerChildren.push(line(contact, { size: 16, color: theme.secondary }));
  } else {
    headerChildren.push(
      logoParagraph(image, brand),
      line(name, { bold: true, size: 36, color: theme.secondary }),
      line(contact, { size: 16, color: "475569" }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: hex(theme.primary), space: 4 } },
        children: [new TextRun("")],
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: hex(theme.accent), space: 1 } },
        children: [new TextRun("")],
      }),
    );
    footerChildren.push(
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: hex(theme.accent), space: 8 } },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contact, size: 16, color: "475569", font: "Calibri" })],
      }),
    );
  }

  footerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80 },
      children: [
        new TextRun({ text: "Page ", size: 16, color: "94A3B8", font: "Calibri" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "94A3B8", font: "Calibri" }),
      ],
    }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4.width, height: A4.height },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        headers: {
          default: new Header({ children: headerChildren }),
        },
        footers: {
          default: new Footer({ children: footerChildren }),
        },
        children: bodyParagraphs(blank, theme.primary),
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function letterheadFilename(schoolName: string, blank: boolean) {
  const base = (schoolName || "School").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") || "School";
  return `${base}_${blank ? "Blank_" : ""}Letterhead.docx`;
}
