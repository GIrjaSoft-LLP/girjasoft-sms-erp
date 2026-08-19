import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export const MAX_ADMISSION_FILE_BYTES = 5 * 1024 * 1024;

export function admissionFileExt(file: File) {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
}

export async function saveAdmissionDocument(
  workspaceId: string,
  applicationId: string,
  file: File,
) {
  const ext = admissionFileExt(file);
  if (!ext) throw new Error("Upload a JPG, PNG, WEBP or PDF file.");
  if (file.size > MAX_ADMISSION_FILE_BYTES) throw new Error("File must be 5 MB or smaller.");
  const dir = path.join(process.cwd(), "public", "uploads", "workspaces", workspaceId, "admissions", applicationId);
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
  return {
    url: `/uploads/workspaces/${workspaceId}/admissions/${applicationId}/${safe}`,
    size: file.size,
    mime: file.type || ext,
  };
}
