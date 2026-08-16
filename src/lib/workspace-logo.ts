import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function logoDir(workspaceId: string) {
  return path.join(process.cwd(), "public", "uploads", "workspaces", workspaceId);
}

export function publicLogoPath(workspaceId: string, ext: string) {
  return `/uploads/workspaces/${workspaceId}/logo.${ext}`;
}

export function extensionFor(file: File) {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".gif")) return "gif";
  return null;
}

export async function saveWorkspaceLogo(workspaceId: string, file: File) {
  const ext = extensionFor(file);
  if (!ext) {
    throw new Error("Upload a PNG, JPG, WEBP or GIF image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }
  const dir = logoDir(workspaceId);
  await mkdir(dir, { recursive: true });
  const existing = await readdir(dir).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith("logo."))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
  const dest = path.join(dir, `logo.${ext}`);
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return `${publicLogoPath(workspaceId, ext)}?v=${Date.now()}`;
}

export async function removeWorkspaceLogoFile(workspaceId: string) {
  const dir = logoDir(workspaceId);
  const existing = await readdir(dir).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith("logo."))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}
