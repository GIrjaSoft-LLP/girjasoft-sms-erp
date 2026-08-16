import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export const MAX_TICKET_FILE_BYTES = 5 * 1024 * 1024;

export function ticketFileExt(file: File) {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".doc")) return "doc";
  if (name.endsWith(".docx")) return "docx";
  return null;
}

export async function saveTicketFile(workspaceId: string, ticketId: string, file: File) {
  const ext = ticketFileExt(file);
  if (!ext) {
    throw new Error("Attach a JPG, PNG, WEBP, PDF or Word document.");
  }
  if (file.size > MAX_TICKET_FILE_BYTES) {
    throw new Error("Attachment must be 5 MB or smaller.");
  }
  const dir = path.join(process.cwd(), "public", "uploads", "workspaces", workspaceId, "tickets", ticketId);
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
  return {
    name: file.name,
    url: `/uploads/workspaces/${workspaceId}/tickets/${ticketId}/${safe}`,
    size: file.size,
    mime: file.type || ext,
  };
}
