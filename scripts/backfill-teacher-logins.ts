import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { ensureTeacherLogin } from "../src/lib/teacher-account";
import { Role, User } from "../src/models/identity";
import { Workspace } from "../src/models/platform";
import { Teacher } from "../src/models/workspace";

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
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });
  const workspace = await Workspace.findOne({ code: "GIRJSOFT-DM-01" });
  if (!workspace) throw new Error("Workspace not found");
  const workspaceId = String(workspace._id);
  const teacherRole = await Role.findOne({ workspaceId: workspace._id, slug: "teacher" });
  if (!teacherRole) throw new Error("Teacher role missing");

  const teachers = await Teacher.find({ workspaceId: workspace._id });
  let created = 0;
  let existing = 0;
  for (const teacher of teachers) {
    const before = await User.findOne({ workspaceId: workspace._id, linkedTeacherId: teacher._id });
    await ensureTeacherLogin({
      workspaceId,
      teacher,
      createPassword: true,
    });
    if (before) existing += 1;
    else created += 1;
  }

  const orphanUsers = await User.find({
    workspaceId: workspace._id,
    roleIds: teacherRole._id,
    $or: [{ linkedTeacherId: null }, { linkedTeacherId: { $exists: false } }],
  });
  let profilesFromUsers = 0;
  for (const user of orphanUsers) {
    const roles = await Role.find({ _id: { $in: user.roleIds } }).select("slug");
    if (!roles.every((role) => role.slug === "teacher")) continue;
    const teacher = await Teacher.create({
      workspaceId: workspace._id,
      employeeId: user.employeeId || `T-${String(user._id).slice(-8)}`,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      department: user.department || "Academic",
      status: user.status === "DISABLED" ? "INACTIVE" : "ACTIVE",
    });
    await ensureTeacherLogin({ workspaceId, teacher, createPassword: false });
    profilesFromUsers += 1;
  }

  console.log(
    JSON.stringify(
      {
        teachers: await Teacher.countDocuments({ workspaceId: workspace._id }),
        loginsCreated: created,
        alreadyLinked: existing,
        profilesFromOrphanUsers: profilesFromUsers,
        teacherUsers: await User.countDocuments({
          workspaceId: workspace._id,
          linkedTeacherId: { $ne: null },
        }),
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
