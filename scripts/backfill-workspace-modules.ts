import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { getAllAvailableModuleIds } from "../src/config/erp-modules";
import { migrateEnabledModules } from "../src/lib/workspace-modules";
import { Workspace } from "../src/models/platform";

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
  if (!uri) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp" });
  const workspaces = await Workspace.find();
  const allAvailable = getAllAvailableModuleIds();
  let updated = 0;

  for (const workspace of workspaces) {
    if (workspace.moduleConfigVersion === 2) {
      continue;
    }
    const migrated = migrateEnabledModules(workspace.enabledModules);
    workspace.enabledModules = migrated;
    workspace.moduleConfigVersion = 2;
    await workspace.save();
    updated += 1;
    console.log(`${workspace.code}: enabled ${migrated.length}/${allAvailable.length} modules`);
  }

  console.log(`Backfill complete. Updated ${updated} workspace(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed.");
  await mongoose.disconnect();
  process.exit(1);
});
