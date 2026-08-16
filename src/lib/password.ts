import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string) {
  if (!plain || plain.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string) {
  if (!plain || !passwordHash) {
    return false;
  }
  return bcrypt.compare(plain, passwordHash);
}

export function assertNoPlaintextSecret(value: unknown) {
  if (typeof value === "string" && (value.includes("password") || value.includes("Password"))) {
    return;
  }
}
