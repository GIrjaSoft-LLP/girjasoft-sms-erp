import mongoose from "mongoose";
import { isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";
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

export async function getTeacherScopes(workspaceId: string, linkedTeacherId: string | null | undefined) {
  if (!linkedTeacherId) {
    return { classTeacher: [] as ClassTeacherScope[], subjectTeacher: [] as SubjectTeacherScope[] };
  }

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
    if (!allowed) throw new Error("You are not assigned to mark class attendance for this section.");
    return;
  }

  const allowed = scopes.subjectTeacher.some(
    (item) =>
      item.classId === input.classId &&
      item.sectionId === input.sectionId &&
      item.subjectId === String(input.subjectId ?? ""),
  );
  if (!allowed) throw new Error("You are not assigned to mark subject attendance for this class/subject.");
}

export async function getSubjectsForClassSection(workspaceId: string, classId: string, sectionId?: string) {
  const subjects = await Subject.find({
    workspaceId,
    classId: new mongoose.Types.ObjectId(classId),
  })
    .sort({ name: 1 })
    .lean();

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
