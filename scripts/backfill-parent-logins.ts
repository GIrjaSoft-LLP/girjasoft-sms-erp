import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_ROLE_DEFINITIONS } from "../src/config/permissions";
import { ensureParentLogin } from "../src/lib/parent-account";
import { Role, User } from "../src/models/identity";
import { Workspace } from "../src/models/platform";
import { Parent, Student } from "../src/models/workspace";

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

  const parentRoleDef = DEFAULT_ROLE_DEFINITIONS.find((role) => role.slug === "parent");
  if (parentRoleDef) {
    await Role.updateOne(
      { workspaceId: workspace._id, slug: "parent" },
      { $set: { permissions: parentRoleDef.permissions, name: parentRoleDef.name, isSystem: true } },
    );
  }

  const parents = await Parent.find({ workspaceId: workspace._id });
  let created = 0;
  let existing = 0;
  for (const parent of parents) {
    const students = await Student.find({
      workspaceId: workspace._id,
      $or: [{ parentId: parent._id }, { _id: { $in: parent.studentIds ?? [] } }],
    }).select("_id");
    const studentIds = students.map((row) => row._id);
    if (studentIds.length) {
      parent.studentIds = studentIds;
      await parent.save();
      await Student.updateMany(
        { workspaceId: workspace._id, _id: { $in: studentIds } },
        { $set: { parentId: parent._id } },
      );
    }
    const before = await User.findOne({ workspaceId: workspace._id, linkedParentId: parent._id });
    await ensureParentLogin({
      workspaceId,
      parent,
      createPassword: true,
    });
    if (before) existing += 1;
    else created += 1;
  }

  const parentRole = await Role.findOne({ workspaceId: workspace._id, slug: "parent" });
  const orphanParentUsers = parentRole
    ? await User.find({
        workspaceId: workspace._id,
        roleIds: parentRole._id,
        $or: [{ linkedParentId: null }, { linkedParentId: { $exists: false } }],
      })
    : [];
  let profilesFromUsers = 0;
  for (const user of orphanParentUsers) {
    const parent = await Parent.create({
      workspaceId: workspace._id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      status: user.status === "DISABLED" ? "INACTIVE" : "ACTIVE",
    });
    await ensureParentLogin({
      workspaceId,
      parent,
      createPassword: false,
    });
    profilesFromUsers += 1;
  }

  console.log(
    JSON.stringify(
      {
        parents: await Parent.countDocuments({ workspaceId: workspace._id }),
        loginsCreated: created,
        alreadyLinked: existing,
        profilesFromOrphanUsers: profilesFromUsers,
        parentUsers: await User.countDocuments({ workspaceId: workspace._id, linkedParentId: { $ne: null } }),
        orphanParentUsers: parentRole
          ? await User.countDocuments({
              workspaceId: workspace._id,
              roleIds: parentRole._id,
              $or: [{ linkedParentId: null }, { linkedParentId: { $exists: false } }],
            })
          : 0,
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
