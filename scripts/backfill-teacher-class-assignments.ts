import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { backfillTeacherClassAssignmentsFromLegacy } from "../src/lib/teacher-class-assignments";
import { Workspace } from "../src/models/platform";

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
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/girjasoft_sms_erp");
  const workspaceCode = process.argv[2];
  const query = workspaceCode ? { code: workspaceCode } : { status: "ACTIVE" };
  const workspaces = await Workspace.find(query).select("_id code name").lean();

  if (!workspaces.length) {
    console.log("No workspaces matched.");
    process.exit(0);
  }

  for (const workspace of workspaces) {
    const result = await backfillTeacherClassAssignmentsFromLegacy(String(workspace._id));
    console.log(`${workspace.code} (${workspace.name}): created ${result.created} of ${result.total} legacy pairs`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
