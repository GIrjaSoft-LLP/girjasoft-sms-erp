import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type PhotoKind = "students" | "teachers" | "platform";

export function photoDir(workspaceId: string, kind: PhotoKind) {
  if (kind === "platform") {
    return path.join(process.cwd(), "uploads", "platform", "photos");
  }
  return path.join(process.cwd(), "uploads", "workspaces", workspaceId, "photos", kind);
}

function photoDirs(workspaceId: string, kind: PhotoKind) {
  if (kind === "platform") {
    return [
      photoDir("platform", kind),
      path.join(process.cwd(), "public", "uploads", "platform", "photos"),
    ];
  }
  return [
    photoDir(workspaceId, kind),
    path.join(process.cwd(), "public", "uploads", "workspaces", workspaceId, "photos", kind),
  ];
}

export function extensionForPhoto(file: File) {
  const fromType = ALLOWED.get(file.type);
  if (fromType) return fromType;
  const name = String(file.name ?? "").toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp")) return "webp";
  return null;
}

export function publicPhotoPath(workspaceId: string, kind: PhotoKind, recordId: string, ext: string) {
  if (kind === "platform") return `/uploads/platform/photos/${recordId}.${ext}`;
  return `/uploads/workspaces/${workspaceId}/photos/${kind}/${recordId}.${ext}`;
}

async function removeMatching(dir: string, recordId: string) {
  const existing = await readdir(dir).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith(`${recordId}.`))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

export async function saveProfilePhoto(
  workspaceId: string,
  kind: PhotoKind,
  recordId: string,
  file: File,
) {
  const ext = extensionForPhoto(file);
  if (!ext) {
    throw new Error("Upload a JPG, PNG or WEBP image.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length) {
    throw new Error("Choose a photo to upload.");
  }
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 2 MB or smaller.");
  }
  const dir = photoDir(workspaceId, kind);
  await mkdir(dir, { recursive: true });
  await removeMatching(dir, recordId);
  const dest = path.join(/* turbopackIgnore: true */ dir, `${recordId}.${ext}`);
  await writeFile(dest, bytes);
  return `${publicPhotoPath(workspaceId, kind, recordId, ext)}?v=${Date.now()}`;
}

export async function removeProfilePhoto(workspaceId: string, kind: PhotoKind, recordId: string) {
  await Promise.all(photoDirs(workspaceId, kind).map((dir) => removeMatching(dir, recordId)));
}

export async function saveGeneratedPng(
  workspaceId: string,
  kind: PhotoKind,
  recordId: string,
  png: Buffer,
) {
  const dir = photoDir(workspaceId, kind);
  await mkdir(dir, { recursive: true });
  await removeMatching(dir, recordId);
  await writeFile(path.join(/* turbopackIgnore: true */ dir, `${recordId}.png`), png);
  return `${publicPhotoPath(workspaceId, kind, recordId, "png")}?v=${Date.now()}`;
}

function mimeForExt(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function readProfilePhoto(workspaceId: string, kind: PhotoKind, recordId: string) {
  for (const dir of photoDirs(workspaceId, kind)) {
    const existing = await readdir(dir).catch(() => []);
    const match = existing.find((name) => name.startsWith(`${recordId}.`));
    if (!match) continue;
    const ext = match.split(".").pop()?.toLowerCase() ?? "jpg";
    const buffer = await readFile(path.join(dir, match));
    return { buffer, mime: mimeForExt(ext) };
  }
  return null;
}

export async function profilePhotoExists(workspaceId: string, kind: PhotoKind, recordIds: string[]) {
  const found = new Set<string>();
  for (const dir of photoDirs(workspaceId, kind)) {
    const existing = await readdir(dir).catch(() => []);
    for (const id of recordIds) {
      if (existing.some((name) => name.startsWith(`${id}.`))) found.add(id);
    }
  }
  return found;
}

export async function attachProfilePhotoUrls<T extends { _id?: unknown; photo?: unknown }>(
  workspaceId: string,
  kind: PhotoKind,
  items: T[],
) {
  const photos = await profilePhotoExists(
    workspaceId,
    kind,
    items.map((item) => String(item._id)),
  );
  return items.map((item) => {
    const id = String(item._id);
    const hasPhoto = Boolean(item.photo) || photos.has(id);
    return { ...item, photo: hasPhoto ? `/api/${kind}/${id}/photo` : "" };
  });
}

export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (value == null || typeof value === "string") return false;
  const file = value as File;
  return typeof file.arrayBuffer === "function";
}
