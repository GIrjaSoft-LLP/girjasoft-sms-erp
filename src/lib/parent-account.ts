import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "@/lib/api/guards";
import { hashPassword } from "@/lib/password";
import { Role, User } from "@/models/identity";
import { Parent, Student } from "@/models/workspace";

export const PORTAL_ROLE_SLUGS = ["parent", "student", "teacher"] as const;

export function generateLoginPassword() {
  return `Gs@${randomBytes(6).toString("base64url")}9A`;
}

export function parseObjectIds(value: unknown) {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "")
        .split(/[\s,]+/)
        .filter(Boolean);
  return raw
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export async function portalRoleIds(workspaceId: string) {
  const roles = await Role.find({
    workspaceId,
    slug: { $in: [...PORTAL_ROLE_SLUGS] },
  }).select("_id");
  return roles.map((role) => role._id);
}

export function excludePortalAccounts() {
  return {
    $nor: [
      { linkedParentId: { $ne: null } },
      { linkedStudentId: { $ne: null } },
      { linkedTeacherId: { $ne: null } },
    ],
  };
}

export async function staffUserQuery(workspaceId: string, extra: Record<string, unknown> = {}) {
  const excluded = await portalRoleIds(workspaceId);
  return {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    ...extra,
    ...(excluded.length ? { roleIds: { $nin: excluded } } : {}),
    ...excludePortalAccounts(),
  };
}

export async function assertStaffManagedUser(
  workspaceId: string,
  user: { roleIds?: unknown[]; linkedParentId?: unknown; linkedTeacherId?: unknown },
) {
  if (user.linkedParentId) {
    throw new ApiError(400, "Parent logins are managed from Student Info → Parents / Guardians.");
  }
  if (user.linkedTeacherId) {
    throw new ApiError(400, "Teacher logins are managed from the Teachers section.");
  }
  const roles = await Role.find({
    _id: { $in: user.roleIds ?? [] },
    workspaceId,
  }).select("slug");
  if (roles.some((role) => PORTAL_ROLE_SLUGS.includes(role.slug as (typeof PORTAL_ROLE_SLUGS)[number]))) {
    throw new ApiError(400, "Parent, student and teacher logins are managed from their own sections.");
  }
}

export async function getParentRoleId(workspaceId: string) {
  const role = await Role.findOne({ workspaceId, slug: "parent" });
  if (!role) throw new ApiError(500, "Parent role is not configured for this workspace.");
  return role._id;
}

async function uniqueUsername(workspaceId: string, preferred: string, parentId: string) {
  const base = preferred
    .toLowerCase()
    .replace(/[^a-z0-9._@-]/g, "")
    .slice(0, 40);
  let username = base || `parent.${parentId.slice(-8)}`;
  let n = 1;
  while (await User.findOne({ workspaceId, username })) {
    username = `${base.slice(0, 32)}.${n}`;
    n += 1;
  }
  return username;
}

async function uniqueEmail(workspaceId: string, email: string, parentId: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized && !(await User.findOne({ workspaceId, email: normalized }))) {
    return normalized;
  }
  let candidate = `parent.${parentId.slice(-10)}@login.girjasoft.in`;
  let n = 1;
  while (await User.findOne({ workspaceId, email: candidate })) {
    candidate = `parent.${parentId.slice(-8)}.${n}@login.girjasoft.in`;
    n += 1;
  }
  return candidate;
}

export async function syncParentStudents(
  workspaceId: string,
  parentId: mongoose.Types.ObjectId,
  studentIds: mongoose.Types.ObjectId[],
) {
  const unique = [...new Map(studentIds.map((id) => [String(id), id])).values()];
  const students = await Student.find({
    workspaceId,
    _id: { $in: unique },
  });
  if (students.length !== unique.length) {
    throw new ApiError(400, "One or more students are invalid for this workspace.");
  }

  await Student.updateMany(
    { workspaceId, parentId, _id: { $nin: unique } },
    { $set: { parentId: null } },
  );
  await Parent.updateMany(
    { workspaceId, _id: { $ne: parentId }, studentIds: { $in: unique } },
    { $pull: { studentIds: { $in: unique } } },
  );
  for (const student of students) {
    student.parentId = parentId;
    await student.save();
  }
  await Parent.findByIdAndUpdate(parentId, { $set: { studentIds: unique } });
  return unique;
}

export async function ensureParentLogin(options: {
  workspaceId: string;
  parent: { _id: unknown; name: string; email?: string; phone?: string; studentIds?: unknown[]; status?: string };
  createPassword: boolean;
}) {
  const workspaceId = options.workspaceId;
  const parentId = new mongoose.Types.ObjectId(String(options.parent._id));
  const roleId = await getParentRoleId(workspaceId);
  const studentIds = (options.parent.studentIds ?? []).map((id) => new mongoose.Types.ObjectId(String(id)));

  let user = await User.findOne({ workspaceId, linkedParentId: parentId });
  if (!user && options.parent.email) {
    const byEmail = await User.findOne({ workspaceId, email: options.parent.email.toLowerCase() });
    if (byEmail && (!byEmail.linkedParentId || String(byEmail.linkedParentId) === String(parentId))) {
      const roles = await Role.find({ _id: { $in: byEmail.roleIds } }).select("slug");
      const slugs = roles.map((role) => role.slug);
      if (!slugs.length || slugs.every((slug) => slug === "parent")) {
        user = byEmail;
      }
    }
  }

  let temporaryPassword: string | undefined;
  if (!user) {
    if (!options.createPassword) return { user: null as typeof user, temporaryPassword };
    temporaryPassword = generateLoginPassword();
    const email = await uniqueEmail(workspaceId, options.parent.email ?? "", String(parentId));
    const username = await uniqueUsername(
      workspaceId,
      options.parent.email || `parent.${String(parentId).slice(-8)}`,
      String(parentId),
    );
    user = await User.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: options.parent.name,
      email,
      phone: options.parent.phone ?? "",
      username,
      passwordHash: await hashPassword(temporaryPassword),
      department: "Academic",
      employeeId: `P-${String(parentId).slice(-10)}`,
      roleIds: [roleId],
      status: options.parent.status === "INACTIVE" ? "DISABLED" : "ACTIVE",
      linkedParentId: parentId,
      linkedStudentIds: studentIds,
      linkedStudentId: studentIds[0] ?? null,
    });
  } else {
    user.name = options.parent.name;
    user.phone = options.parent.phone ?? user.phone;
    if (options.parent.email) {
      const wanted = options.parent.email.toLowerCase();
      const clash = await User.findOne({ workspaceId, email: wanted, _id: { $ne: user._id } });
      if (!clash) user.email = wanted;
    }
    user.linkedParentId = parentId;
    user.linkedStudentIds = studentIds;
    user.linkedStudentId = studentIds[0] ?? null;
    const roleIds = (user.roleIds ?? []).map((id: unknown) => String(id));
    if (!roleIds.includes(String(roleId))) {
      user.roleIds = [roleId];
    }
    if (options.parent.status === "INACTIVE") user.status = "DISABLED";
    if (options.parent.status === "ACTIVE" && user.status === "DISABLED" && options.createPassword === false) {
      // keep disabled unless explicitly enabled elsewhere
    }
    await user.save();
  }

  return { user, temporaryPassword };
}

export async function resetParentPassword(workspaceId: string, parentId: string) {
  const parent = await Parent.findOne({ _id: parentId, workspaceId });
  if (!parent) throw new ApiError(404, "Parent not found.");
  const { user } = await ensureParentLogin({ workspaceId, parent, createPassword: true });
  if (!user) throw new ApiError(404, "Parent login was not found.");
  const temporaryPassword = generateLoginPassword();
  user.passwordHash = await hashPassword(temporaryPassword);
  user.status = "ACTIVE";
  await user.save();
  return { username: user.username, email: user.email, temporaryPassword, role: "Parent" };
}
