import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";
import { getAdminAssignmentScopes } from "@/lib/teacher-class-assignments";
import { getAttendanceSettings } from "@/lib/attendance/settings";
import { SchoolClass, Section, Subject, Timetable } from "@/models/workspace";

export function hasSchoolWideAttendanceAccess(session: SessionPayload, permissions: string[]) {
  if (isParentLike(session.roleSlugs) || isStudentLike(session.roleSlugs)) return false;
  if (
    session.sessionRole === "SUPER_ADMIN" ||
    permissions.includes("attendance.edit") ||
    permissions.includes("attendance.delete") ||
    permissions.includes("attendance.reports")
  ) {
    return true;
  }
  if (!isTeacherLike(session.roleSlugs) && permissions.includes("attendance.view") && permissions.includes("students.view")) {
    return true;
  }
  return false;
}

export type ClassTeacherScope = {
  kind: "CLASS";
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  label: string;
};

export type SubjectTeacherScope = {
  kind: "SUBJECT";
  classId: string;
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  label: string;
};

export function canManageAllAttendance(session: SessionPayload, permissions: string[]) {
  return hasSchoolWideAttendanceAccess(session, permissions);
}

async function getLegacyTeacherScopes(workspaceId: string, linkedTeacherId: string) {
  const teacherObjectId = new mongoose.Types.ObjectId(linkedTeacherId);
  const [sections, timetableRows, classes, subjects] = await Promise.all([
    Section.find({ workspaceId, classTeacherId: teacherObjectId }).lean(),
    Timetable.find({ workspaceId, teacherId: teacherObjectId }).lean(),
    SchoolClass.find({ workspaceId }).select("name").lean(),
    Subject.find({ workspaceId }).select("name classId").lean(),
  ]);

  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const subjectMap = new Map(subjects.map((row) => [String(row._id), row]));

  const classTeacher: ClassTeacherScope[] = sections.map((section) => ({
    kind: "CLASS",
    classId: String(section.classId),
    sectionId: String(section._id),
    className: classMap.get(String(section.classId)) ?? "",
    sectionName: section.name,
    label: `${classMap.get(String(section.classId)) ?? "Class"}-${section.name} (Class Teacher)`,
  }));

  const subjectTeacherMap = new Map<string, SubjectTeacherScope>();
  for (const slot of timetableRows) {
    if (!slot.subjectId) continue;
    const key = `${slot.classId}:${slot.sectionId}:${slot.subjectId}`;
    if (subjectTeacherMap.has(key)) continue;
    const subject = subjectMap.get(String(slot.subjectId));
    subjectTeacherMap.set(key, {
      kind: "SUBJECT",
      classId: String(slot.classId),
      sectionId: String(slot.sectionId ?? ""),
      subjectId: String(slot.subjectId),
      className: classMap.get(String(slot.classId)) ?? "",
      sectionName: "",
      subjectName: subject?.name ?? "",
      label: `${classMap.get(String(slot.classId)) ?? "Class"} · ${subject?.name ?? "Subject"}`,
    });
  }

  const sectionIds = [...new Set([...subjectTeacherMap.values()].map((item) => item.sectionId).filter(Boolean))];
  const sectionRows = sectionIds.length
    ? await Section.find({ workspaceId, _id: { $in: sectionIds } }).select("name").lean()
    : [];
  const sectionNameMap = new Map(sectionRows.map((row) => [String(row._id), row.name]));
  const subjectTeacher = [...subjectTeacherMap.values()].map((item) => ({
    ...item,
    sectionName: sectionNameMap.get(item.sectionId) ?? item.sectionName,
    label: `${item.className}${item.sectionName ? `-${item.sectionName}` : ""} · ${item.subjectName}`,
  }));

  return { classTeacher, subjectTeacher };
}

function mergeTeacherScopes(
  legacy: { classTeacher: ClassTeacherScope[]; subjectTeacher: SubjectTeacherScope[] },
  admin: { classTeacher: ClassTeacherScope[]; subjectTeacher: SubjectTeacherScope[] },
) {
  const classTeacherMap = new Map<string, ClassTeacherScope>();
  for (const item of [...legacy.classTeacher, ...admin.classTeacher]) {
    if (!classTeacherMap.has(item.sectionId)) {
      classTeacherMap.set(item.sectionId, item);
    }
  }

  const subjectTeacherMap = new Map<string, SubjectTeacherScope>();
  for (const item of [...legacy.subjectTeacher, ...admin.subjectTeacher]) {
    const key = `${item.classId}:${item.sectionId}:${item.subjectId}`;
    if (!subjectTeacherMap.has(key)) {
      subjectTeacherMap.set(key, item);
    }
  }

  return {
    classTeacher: [...classTeacherMap.values()],
    subjectTeacher: [...subjectTeacherMap.values()],
  };
}

export async function getTeacherScopes(workspaceId: string, linkedTeacherId: string | null | undefined) {
  if (!linkedTeacherId) {
    return { classTeacher: [] as ClassTeacherScope[], subjectTeacher: [] as SubjectTeacherScope[] };
  }

  const [legacy, admin] = await Promise.all([
    getLegacyTeacherScopes(workspaceId, linkedTeacherId),
    getAdminAssignmentScopes(workspaceId, linkedTeacherId),
  ]);

  return mergeTeacherScopes(legacy, admin);
}

export async function resolveAttendanceScopes(
  workspaceId: string,
  session: SessionPayload,
  permissions: string[],
  impersonating: boolean,
) {
  if (canManageAllAttendance(session, permissions) || impersonating) {
    return {
      allAccess: true as const,
      classTeacher: [] as ClassTeacherScope[],
      subjectTeacher: [] as SubjectTeacherScope[],
    };
  }

  if (isTeacherLike(session.roleSlugs) && session.linkedTeacherId) {
    const scopes = await getTeacherScopes(workspaceId, session.linkedTeacherId);
    return { allAccess: false as const, ...scopes };
  }

  return { allAccess: false as const, classTeacher: [] as ClassTeacherScope[], subjectTeacher: [] as SubjectTeacherScope[] };
}

export function assertScopeAccess(
  scopes: Awaited<ReturnType<typeof resolveAttendanceScopes>>,
  input: { attendanceType: "CLASS" | "SUBJECT"; classId: string; sectionId: string; subjectId?: string | null },
) {
  if (scopes.allAccess) return;

  if (input.attendanceType === "CLASS") {
    const allowed = scopes.classTeacher.some(
      (item) => item.classId === input.classId && item.sectionId === input.sectionId,
    );
    if (!allowed) {
      throw new ApiError(403, "You are not assigned to mark class attendance for this section.");
    }
    return;
  }

  const allowed = scopes.subjectTeacher.some(
    (item) =>
      item.classId === input.classId &&
      item.sectionId === input.sectionId &&
      item.subjectId === String(input.subjectId ?? ""),
  );
  if (!allowed) {
    throw new ApiError(403, "You are not assigned to mark subject attendance for this class/subject.");
  }
}

export function collectAllowedSectionIds(scopes: Awaited<ReturnType<typeof resolveAttendanceScopes>>) {
  if (scopes.allAccess) return null;
  const sectionIds = new Set<string>();
  for (const item of scopes.classTeacher) sectionIds.add(item.sectionId);
  for (const item of scopes.subjectTeacher) {
    if (item.sectionId) sectionIds.add(item.sectionId);
  }
  return sectionIds;
}

export async function getSubjectsForClassSection(
  workspaceId: string,
  classId: string,
  sectionId?: string,
  scopes?: Awaited<ReturnType<typeof resolveAttendanceScopes>>,
) {
  const subjects = await Subject.find({
    workspaceId,
    classId: new mongoose.Types.ObjectId(classId),
  })
    .sort({ name: 1 })
    .lean();

  if (scopes && !scopes.allAccess) {
    const allowedSubjectIds = new Set(
      scopes.subjectTeacher
        .filter(
          (item) =>
            item.classId === classId && (!sectionId || !item.sectionId || item.sectionId === sectionId),
        )
        .map((item) => item.subjectId),
    );
    if (!allowedSubjectIds.size) return [];
    return subjects.filter((subject) => allowedSubjectIds.has(String(subject._id)));
  }

  if (!sectionId) return subjects;

  const assignedSubjectIds = new Set(
    (
      await Timetable.find({
        workspaceId,
        classId: new mongoose.Types.ObjectId(classId),
        sectionId: new mongoose.Types.ObjectId(sectionId),
      })
        .select("subjectId")
        .lean()
    )
      .map((row) => String(row.subjectId))
      .filter(Boolean),
  );

  if (!assignedSubjectIds.size) return subjects;
  return subjects.filter((subject) => assignedSubjectIds.has(String(subject._id)));
}

export async function getTeacherAttendanceMarkOptions(ctx: TenantContext) {
  const scopes = await resolveAttendanceScopes(
    ctx.workspaceId,
    ctx.session,
    ctx.permissions,
    ctx.impersonating,
  );
  const settings = await getAttendanceSettings(ctx.workspaceId);

  if (scopes.allAccess) {
    const [classes, sections, subjects] = await Promise.all([
      SchoolClass.find({ workspaceId: ctx.workspaceId, status: { $ne: "INACTIVE" } })
        .sort({ numericName: 1, name: 1 })
        .select("name")
        .lean(),
      Section.find({ workspaceId: ctx.workspaceId }).sort({ name: 1 }).select("name classId").lean(),
      Subject.find({ workspaceId: ctx.workspaceId }).sort({ name: 1 }).select("name code classId").lean(),
    ]);
    return {
      allAccess: true,
      settings,
      scopes,
      classes: classes.map((row) => ({ _id: String(row._id), name: row.name })),
      sections: sections.map((row) => ({
        _id: String(row._id),
        name: row.name,
        classId: String(row.classId),
      })),
      subjects: subjects.map((row) => ({
        _id: String(row._id),
        name: row.name,
        code: row.code ?? "",
        classId: String(row.classId),
      })),
    };
  }

  const classMap = new Map<string, { _id: string; name: string }>();
  const sectionMap = new Map<string, { _id: string; name: string; classId: string }>();
  const subjectIds = new Set<string>();

  for (const item of scopes.classTeacher) {
    classMap.set(item.classId, { _id: item.classId, name: item.className });
    sectionMap.set(item.sectionId, {
      _id: item.sectionId,
      name: item.sectionName,
      classId: item.classId,
    });
  }
  for (const item of scopes.subjectTeacher) {
    classMap.set(item.classId, { _id: item.classId, name: item.className });
    if (item.sectionId) {
      sectionMap.set(item.sectionId, {
        _id: item.sectionId,
        name: item.sectionName,
        classId: item.classId,
      });
    }
    subjectIds.add(item.subjectId);
  }

  const subjects = subjectIds.size
    ? await Subject.find({ workspaceId: ctx.workspaceId, _id: { $in: [...subjectIds] } })
        .sort({ name: 1 })
        .select("name code classId")
        .lean()
    : [];

  return {
    allAccess: false,
    settings,
    scopes,
    classes: [...classMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sections: [...sectionMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    subjects: subjects.map((row) => ({
      _id: String(row._id),
      name: row.name,
      code: row.code ?? "",
      classId: String(row.classId),
    })),
  };
}
