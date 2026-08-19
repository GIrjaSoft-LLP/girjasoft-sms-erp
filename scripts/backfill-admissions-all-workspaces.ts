import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_ADMISSION_SETTINGS } from "../src/config/admissions";
import { ensureAdmissionSettings } from "../src/lib/admissions/settings";
import { syncSystemRolesForWorkspace } from "../src/lib/system-role-sync";
import { CURRENT_MODULE_CONFIG_VERSION } from "../src/lib/workspace-modules";
import { ensureWorkspaceReady } from "../src/lib/workspace-setup-server";
import { Workspace } from "../src/models/platform";
import { Settings } from "../src/models/workspace";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
  let modulesUpdated = 0;
  let settingsUpdated = 0;
  let rolesUpdated = 0;

  for (const workspace of workspaces) {
    const beforeModules = [...(workspace.enabledModules ?? [])];
    const beforeVersion = workspace.moduleConfigVersion ?? 1;

    const enabled = await ensureWorkspaceReady(workspace);
    if (beforeVersion < CURRENT_MODULE_CONFIG_VERSION || beforeModules.length !== enabled.length) {
      modulesUpdated += 1;
      console.log(`${workspace.code}: modules ${beforeModules.length} -> ${enabled.length} (admissions ${enabled.includes("admissions") ? "ON" : "OFF"})`);
    }

    const settings = await Settings.findOne({ workspaceId: workspace._id });
    if (!settings?.admission || !Object.keys(settings.admission as object).length) {
      await Settings.findOneAndUpdate(
        { workspaceId: workspace._id },
        { $set: { admission: DEFAULT_ADMISSION_SETTINGS } },
        { upsert: true },
      );
      settingsUpdated += 1;
      console.log(`${workspace.code}: admission settings initialized`);
    } else {
      await ensureAdmissionSettings(String(workspace._id));
    }

    const roleChanges = await syncSystemRolesForWorkspace(String(workspace._id));
    if (roleChanges > 0) {
      rolesUpdated += roleChanges;
      console.log(`${workspace.code}: synced ${roleChanges} system role(s) with admissions permissions`);
    }
  }

  console.log(
    `Admission backfill complete for ${workspaces.length} workspace(s). Modules updated: ${modulesUpdated}, settings: ${settingsUpdated}, roles: ${rolesUpdated}.`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed.");
  await mongoose.disconnect();
  process.exit(1);
});
