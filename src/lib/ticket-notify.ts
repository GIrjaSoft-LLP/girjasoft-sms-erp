import mongoose from "mongoose";
import { Role, User } from "@/models/identity";
import { Notification } from "@/models/workspace";

export async function notifySchoolUser(workspaceId: string, userId: string, title: string, body: string) {
  if (!userId) return;
  await Notification.create({
    workspaceId,
    userId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    title,
    body,
    read: false,
  });
}

export async function notifyWorkspaceUsersByRoles(
  workspaceId: string,
  roleSlugs: string[],
  title: string,
  body: string,
  exceptUserId?: string,
) {
  if (!roleSlugs.length) return;
  const roles = await Role.find({ workspaceId, slug: { $in: roleSlugs } }).select("_id").lean();
  if (!roles.length) return;
  const users = await User.find({
    workspaceId,
    roleIds: { $in: roles.map((role) => role._id) },
    status: { $ne: "ARCHIVED" },
  })
    .select("_id")
    .lean();
  const ids = users
    .map((user) => String(user._id))
    .filter((id) => id && id !== exceptUserId);
  await Promise.all(ids.map((id) => notifySchoolUser(workspaceId, id, title, body)));
}
