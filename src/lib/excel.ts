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
      const raw = row.getCell(index + 1).value;
      const value =
        raw && typeof raw === "object" && "text" in raw
          ? String((raw as { text: string }).text)
          : String(raw ?? "").trim();
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
