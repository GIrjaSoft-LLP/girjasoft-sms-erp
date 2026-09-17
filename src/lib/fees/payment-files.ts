import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const QR_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const RECEIPT_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["application/pdf", "pdf"],
]);

export const MAX_PAYMENT_QR_BYTES = 2 * 1024 * 1024;
export const MAX_FEE_RECEIPT_BYTES = 5 * 1024 * 1024;

function extFrom(file: File, allowed: Map<string, string>) {
  const fromType = allowed.get(file.type);
  if (fromType) return fromType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".webp") && allowed.has("image/webp")) return "webp";
  if (name.endsWith(".pdf") && allowed.has("application/pdf")) return "pdf";
  return null;
}

function workspaceDir(workspaceId: string) {
  return path.join(process.cwd(), "public", "uploads", "workspaces", workspaceId);
}

export async function savePaymentQr(workspaceId: string, file: File) {
  const ext = extFrom(file, QR_TYPES);
  if (!ext) {
    throw new Error("Upload a PNG, JPG or WEBP QR code image.");
  }
  if (file.size > MAX_PAYMENT_QR_BYTES) {
    throw new Error("QR code must be 2 MB or smaller.");
  }
  const dir = workspaceDir(workspaceId);
  await mkdir(dir, { recursive: true });
  const existing = await readdir(dir).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith("payment-qr."))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
  const dest = path.join(dir, `payment-qr.${ext}`);
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return `/uploads/workspaces/${workspaceId}/payment-qr.${ext}?v=${Date.now()}`;
}

export async function removePaymentQrFile(workspaceId: string) {
  const dir = workspaceDir(workspaceId);
  const existing = await readdir(dir).catch(() => []);
  await Promise.all(
    existing
      .filter((name) => name.startsWith("payment-qr."))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

export async function saveFeeReceiptFile(workspaceId: string, studentFeeId: string, file: File) {
  const ext = extFrom(file, RECEIPT_TYPES);
  if (!ext) {
    throw new Error("Upload a PDF, JPG or PNG receipt.");
  }
  if (file.size > MAX_FEE_RECEIPT_BYTES) {
    throw new Error("Receipt must be 5 MB or smaller.");
  }
  const dir = path.join(workspaceDir(workspaceId), "fee-receipts", studentFeeId);
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
  return {
    name: file.name,
    url: `/uploads/workspaces/${workspaceId}/fee-receipts/${studentFeeId}/${safe}`,
    size: file.size,
    mime: file.type || ext,
  };
}
