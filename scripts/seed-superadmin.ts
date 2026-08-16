import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { SUPER_ADMIN_EMAIL } from "../src/config/branding";
import { hashPassword } from "../src/lib/password";
import { PlatformAdmin } from "../src/models/platform";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const uri = process.env.MONGODB_URI;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const email = (process.env.SUPER_ADMIN_EMAIL ?? SUPER_ADMIN_EMAIL).toLowerCase();

  if (!uri) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }
  if (!password) {
    console.error("SUPER_ADMIN_PASSWORD must be set in the environment for initial setup.");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp" });

  const existing = await PlatformAdmin.findOne({ email });
  if (existing) {
    console.log("GirjaSoft Super Admin already exists.");
    console.log("Username:");
    console.log(email);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await hashPassword(password);
  await PlatformAdmin.create({
    email,
    username: email,
    name: "GirjaSoft Super Admin",
    passwordHash,
    role: "SUPER_ADMIN",
    accountType: "PLATFORM",
    workspaceId: null,
    status: "ACTIVE",
  });

  console.log("GirjaSoft Super Admin created successfully.");
  console.log("");
  console.log("Username:");
  console.log(email);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  await mongoose.disconnect();
  process.exit(1);
});
