import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function rowsToExcelBuffer(
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(headers.map((header) => row[header] ?? ""));
  }
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function excelFileResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function formatExcelDate(value: Date) {
  if (Number.isNaN(value.getTime())) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function excelCellText(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (raw instanceof Date) return formatExcelDate(raw);
  if (typeof raw === "object") {
    const cell = raw as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof cell.text === "string" || typeof cell.text === "number") {
      return String(cell.text).trim();
    }
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((part) => part.text ?? "").join("").trim();
    }
    if ("result" in cell) return excelCellText(cell.result);
  }
  return String(raw).trim();
}

export async function readExcelObjects(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "")
      .trim()
      .replace(/\s+/g, "");
  });

  const rows: Array<Record<string, string>> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: Record<string, string> = {};
    let empty = true;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = excelCellText(row.getCell(index + 1).value);
      item[header] = value;
      if (value) empty = false;
    });
    if (!empty) rows.push(item);
  });
  return rows;
}

export function cell(row: Record<string, string>, ...keys: string[]) {
  const lookup = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = lookup[key.toLowerCase()];
    if (value) return value;
  }
  return "";
}
