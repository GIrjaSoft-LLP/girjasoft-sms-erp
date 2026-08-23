import mongoose from "mongoose";
import { ApiError } from "@/lib/api/guards";
import { ensureTeacherLogin } from "@/lib/teacher-account";
import { User } from "@/models/identity";
import { Staff, Teacher } from "@/models/workspace";

export const TEACHER_STAFF_TYPE = "Teacher";

function trimmed(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeStaffType(
  input: { staffType?: unknown; designation?: unknown },
  existing?: { staffType?: unknown; designation?: unknown; linkedTeacherId?: unknown },
) {
  const raw = trimmed(input.staffType);
  if (raw) return raw;
  const existingType = trimmed(existing?.staffType);
  if (existingType) return existingType;
  if (existing?.linkedTeacherId) return TEACHER_STAFF_TYPE;
  const designation = trimmed(input.designation ?? existing?.designation).toLowerCase();
  if (designation.includes("teacher")) return TEACHER_STAFF_TYPE;
  return "";
}

export function isTeacherStaff(staff: {
  staffType?: string;
  designation?: string;
  linkedTeacherId?: unknown;
}) {
  const type = trimmed(staff.staffType).toLowerCase();
  if (type === "teacher") return true;
  if (staff.linkedTeacherId) return true;
  return trimmed(staff.designation).toLowerCase().includes("teacher");
}

export function staffPortalLoginEnabled(body: Record<string, unknown>, isTeacher: boolean) {
  if (!isTeacher) return false;
  return body.enablePortalLogin !== false && body.enablePortalLogin !== "false";
}

type StaffLike = {
  _id: unknown;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  qualification?: string;
  experience?: string;
  joiningDate?: string;
  status?: string;
  staffType?: string;
  linkedTeacherId?: unknown;
  enablePortalLogin?: boolean;
};

export async function syncStaffTeacherProfile(
  workspaceId: string,
  staff: StaffLike,
  options?: { createPassword?: boolean },
) {
  const staffId = new mongoose.Types.ObjectId(String(staff._id));

  if (!isTeacherStaff(staff)) {
    if (staff.linkedTeacherId) {
      await Teacher.findOneAndUpdate(
        { _id: staff.linkedTeacherId, workspaceId },
        { $set: { status: staff.status === "ACTIVE" ? "ACTIVE" : "INACTIVE" } },
      );
      await User.updateMany(
        { workspaceId, linkedTeacherId: staff.linkedTeacherId },
        { $set: { status: staff.status === "ACTIVE" ? "ACTIVE" : "DISABLED" } },
      );
    }
    return { teacher: null as null, login: null as null };
  }

  let teacher = staff.linkedTeacherId
    ? await Teacher.findOne({ _id: staff.linkedTeacherId, workspaceId })
    : null;
  if (!teacher) {
    teacher = await Teacher.findOne({ workspaceId, staffId });
  }
  if (!teacher && staff.employeeId) {
    teacher = await Teacher.findOne({ workspaceId, employeeId: staff.employeeId });
  }

  const teacherPayload = {
    staffId,
    employeeId: staff.employeeId ?? "",
    name: staff.name,
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    department: staff.department || "Academic",
    designation: staff.designation ?? "",
    qualification: staff.qualification ?? "",
    experience: staff.experience ?? "",
    joiningDate: staff.joiningDate ?? "",
    status: staff.status === "INACTIVE" || staff.status === "ON_LEAVE" ? "INACTIVE" : "ACTIVE",
  };

  if (!teacher) {
    teacher = await Teacher.create({
      ...teacherPayload,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
  } else {
    Object.assign(teacher, teacherPayload);
    teacher.staffId = staffId;
    await teacher.save();
  }

  const staffLink: Record<string, unknown> = { linkedTeacherId: teacher._id };
  if (!trimmed(staff.staffType)) {
    staffLink.staffType = TEACHER_STAFF_TYPE;
  }
  await Staff.findByIdAndUpdate(staffId, { $set: staffLink });

  if (!staff.enablePortalLogin) {
    await User.updateMany(
      { workspaceId, linkedTeacherId: teacher._id },
      { $set: { status: "DISABLED" } },
    );
    return { teacher, login: null };
  }

  const { user, temporaryPassword } = await ensureTeacherLogin({
    workspaceId,
    teacher,
    createPassword: options?.createPassword ?? true,
  });

  if (user) {
    user.linkedStaffId = staffId;
    await user.save();
  }

  if (staff.status === "INACTIVE" || staff.status === "ON_LEAVE") {
    await User.updateMany({ workspaceId, linkedTeacherId: teacher._id }, { $set: { status: "DISABLED" } });
  }

  return {
    teacher,
    login: user
      ? {
          name: teacher.name,
          username: user.username,
          email: user.email,
          temporaryPassword,
          role: "Teacher",
        }
      : null,
  };
}

export async function deactivateTeacherForStaff(workspaceId: string, staff: StaffLike) {
  if (!staff.linkedTeacherId) return;
  await Teacher.findOneAndUpdate(
    { _id: staff.linkedTeacherId, workspaceId },
    { $set: { status: "INACTIVE" } },
  );
  await User.updateMany(
    { workspaceId, linkedTeacherId: staff.linkedTeacherId },
    { $set: { status: "DISABLED" } },
  );
}

export function assertTeacherCreationAllowed() {
  throw new ApiError(
    403,
    "Teachers can only be created from Settings → Staff. Set Staff Type to Teacher when adding staff.",
  );
}
