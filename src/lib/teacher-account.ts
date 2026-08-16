import mongoose from "mongoose";
import { ApiError } from "@/lib/api/guards";
import { generateLoginPassword } from "@/lib/parent-account";
import { hashPassword } from "@/lib/password";
import { Role, User } from "@/models/identity";
import { Teacher } from "@/models/workspace";

export async function getTeacherRoleId(workspaceId: string) {
  const role = await Role.findOne({ workspaceId, slug: "teacher" });
  if (!role) throw new ApiError(500, "Teacher role is not configured for this workspace.");
  return role._id;
}

async function uniqueUsername(workspaceId: string, preferred: string, teacherId: string) {
  const base = preferred
    .toLowerCase()
    .replace(/[^a-z0-9._@-]/g, "")
    .slice(0, 40);
  let username = base || `teacher.${teacherId.slice(-8)}`;
  let n = 1;
  while (await User.findOne({ workspaceId, username })) {
    username = `${base.slice(0, 32)}.${n}`;
    n += 1;
  }
  return username;
}

async function uniqueEmail(workspaceId: string, email: string, teacherId: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized && !(await User.findOne({ workspaceId, email: normalized }))) {
    return normalized;
  }
  let candidate = `teacher.${teacherId.slice(-10)}@login.girjasoft.in`;
  let n = 1;
  while (await User.findOne({ workspaceId, email: candidate })) {
    candidate = `teacher.${teacherId.slice(-8)}.${n}@login.girjasoft.in`;
    n += 1;
  }
  return candidate;
}

async function uniqueEmployeeId(workspaceId: string, preferred: string, teacherId: string) {
  const value = preferred.trim();
  if (value && !(await User.findOne({ workspaceId, employeeId: value }))) {
    return value;
  }
  return `T-${teacherId.slice(-10)}`;
}

export async function ensureTeacherLogin(options: {
  workspaceId: string;
  teacher: {
    _id: unknown;
    name: string;
    email?: string;
    phone?: string;
    department?: string;
    employeeId?: string;
    status?: string;
  };
  createPassword: boolean;
}) {
  const workspaceId = options.workspaceId;
  const teacherId = new mongoose.Types.ObjectId(String(options.teacher._id));
  const roleId = await getTeacherRoleId(workspaceId);

  let user = await User.findOne({ workspaceId, linkedTeacherId: teacherId });
  if (!user && options.teacher.email) {
    const byEmail = await User.findOne({ workspaceId, email: options.teacher.email.toLowerCase() });
    if (byEmail) {
      if (byEmail.linkedTeacherId && String(byEmail.linkedTeacherId) !== String(teacherId)) {
        throw new ApiError(400, "This email already belongs to another teacher account.");
      }
      const roles = await Role.find({ _id: { $in: byEmail.roleIds } }).select("slug");
      const slugs = roles.map((role) => role.slug);
      const reusable =
        (!byEmail.linkedParentId && !byEmail.linkedStudentId && slugs.every((slug) => slug === "teacher")) ||
        slugs.length === 0;
      if (!reusable) {
        throw new ApiError(400, "This email belongs to an unrelated user account. Use a different email.");
      }
      user = byEmail;
    }
  }

  let temporaryPassword: string | undefined;
  if (!user) {
    if (!options.createPassword) return { user: null as typeof user, temporaryPassword };
    temporaryPassword = generateLoginPassword();
    const email = await uniqueEmail(workspaceId, options.teacher.email ?? "", String(teacherId));
    const username = await uniqueUsername(
      workspaceId,
      options.teacher.email || `teacher.${String(teacherId).slice(-8)}`,
      String(teacherId),
    );
    user = await User.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      name: options.teacher.name,
      email,
      phone: options.teacher.phone ?? "",
      username,
      passwordHash: await hashPassword(temporaryPassword),
      department: options.teacher.department || "Academic",
      employeeId: await uniqueEmployeeId(workspaceId, options.teacher.employeeId ?? "", String(teacherId)),
      roleIds: [roleId],
      status: options.teacher.status === "INACTIVE" ? "DISABLED" : "ACTIVE",
      linkedTeacherId: teacherId,
    });
  } else {
    user.name = options.teacher.name;
    user.phone = options.teacher.phone ?? user.phone;
    user.department = options.teacher.department || user.department;
    if (options.teacher.email) {
      const wanted = options.teacher.email.toLowerCase();
      const clash = await User.findOne({ workspaceId, email: wanted, _id: { $ne: user._id } });
      if (clash) {
        throw new ApiError(400, "This email belongs to an unrelated user account. Use a different email.");
      }
      user.email = wanted;
    }
    user.linkedTeacherId = teacherId;
    const roleIds = (user.roleIds ?? []).map((id: unknown) => String(id));
    if (!roleIds.includes(String(roleId))) {
      user.roleIds = [roleId];
    }
    if (options.teacher.status === "INACTIVE") user.status = "DISABLED";
    await user.save();
  }

  return { user, temporaryPassword };
}

export async function resetTeacherPassword(workspaceId: string, teacherId: string) {
  const teacher = await Teacher.findOne({ _id: teacherId, workspaceId });
  if (!teacher) throw new ApiError(404, "Teacher not found.");
  const { user } = await ensureTeacherLogin({ workspaceId, teacher, createPassword: true });
  if (!user) throw new ApiError(404, "Teacher login was not found.");
  const temporaryPassword = generateLoginPassword();
  user.passwordHash = await hashPassword(temporaryPassword);
  user.status = "ACTIVE";
  await user.save();
  return { name: user.name, username: user.username, email: user.email, temporaryPassword, role: "Teacher" };
}
