import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_ROLE_DEFINITIONS } from "../src/config/permissions";
import { colorFromName, solidPng } from "../src/lib/placeholder-png";
import { saveGeneratedPng } from "../src/lib/profile-photo";
import { Role } from "../src/models/identity";
import { Workspace } from "../src/models/platform";
import { Student, Teacher } from "../src/models/workspace";

const CODE = "GIRJSOFT-DM-01";

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

async function syncSystemRolePermissions() {
  const defs = new Map(DEFAULT_ROLE_DEFINITIONS.map((role) => [role.slug, role.permissions]));
  const roles = await Role.find({ isSystem: true, slug: { $in: ["student", "teacher", "parent"] } });
  for (const role of roles) {
    const extra = defs.get(role.slug) ?? [];
    const next = Array.from(new Set([...(role.permissions ?? []), ...extra]));
    role.permissions = next;
    await role.save();
  }
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });
  const workspace = await Workspace.findOne({ code: CODE });
  if (!workspace) {
    throw new Error(`${CODE} was not found.`);
  }
  const workspaceId = String(workspace._id);
  await syncSystemRolePermissions();

  const students = await Student.find({ workspaceId: workspace._id }).select("name photo").lean();
  const teachers = await Teacher.find({ workspaceId: workspace._id }).select("name photo").lean();
  let studentCount = 0;
  let teacherCount = 0;

  for (const student of students) {
    const [r, g, b] = colorFromName(String(student.name));
    const photo = await saveGeneratedPng(workspaceId, "students", String(student._id), solidPng(240, 300, r, g, b));
    await Student.updateOne({ _id: student._id }, { $set: { photo } });
    studentCount += 1;
  }
  for (const teacher of teachers) {
    const [r, g, b] = colorFromName(`teacher:${teacher.name}`);
    const photo = await saveGeneratedPng(workspaceId, "teachers", String(teacher._id), solidPng(240, 300, r, g, b));
    await Teacher.updateOne({ _id: teacher._id }, { $set: { photo } });
    teacherCount += 1;
  }

  console.log(`Demo photos: ${studentCount} students, ${teacherCount} teachers in ${CODE}.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
