import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { collectValidObjectIds, isValidObjectId, optionalObjectId } from "@/lib/attendance/object-id";
import type { AttendanceFilterType, ResolvedAttendanceFilter } from "@/lib/attendance/filters";
import { resolveAttendanceScopes } from "@/lib/attendance/scope";
import { assertPortalCanViewStudent, studentIdAllowed } from "@/lib/parent-access";
import { isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import {
  AcademicSession,
  Attendance,
  SchoolClass,
  Section,
  Student,
  Subject,
} from "@/models/workspace";

export type AttendanceScopeFilters = {
  academicSessionId?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  subjectId?: string;
};

export type AttendanceSummary = {
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

export type AttendanceRecordRow = {
  date: string;
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  status: string;
  attendanceType: string;
  subjectName: string;
  remarks: string;
};

export type SubjectAttendanceRow = {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

export type DailyBreakdownRow = {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
};

function countByStatus(records: Array<{ status: string }>) {
  return {
    present: records.filter((row) => row.status === "PRESENT").length,
    absent: records.filter((row) => row.status === "ABSENT").length,
    late: records.filter((row) => row.status === "LATE").length,
    leave: records.filter((row) => row.status === "LEAVE").length,
  };
}

export function summarizeRecords(records: Array<{ status: string; date?: string }>): AttendanceSummary {
  const counts = countByStatus(records);
  const workingDays = new Set(records.map((row) => row.date).filter(Boolean)).size || records.length;
  const presentLike = counts.present + counts.late;
  const denominator = records.length;
  return {
    workingDays: filterTypeUsesUniqueDays(records) ? new Set(records.map((r) => r.date)).size : workingDays,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    leave: counts.leave,
    percentage: denominator ? Math.round((presentLike / denominator) * 10000) / 100 : 0,
  };
}

function filterTypeUsesUniqueDays(records: Array<{ date?: string }>) {
  return records.some((row) => row.date);
}

export function buildDailyBreakdown(records: Array<{ date: string; status: string }>): DailyBreakdownRow[] {
  const byDate = new Map<string, DailyBreakdownRow>();
  for (const row of records) {
    const bucket = byDate.get(row.date) ?? { date: row.date, present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "PRESENT") bucket.present += 1;
    else if (row.status === "ABSENT") bucket.absent += 1;
    else if (row.status === "LATE") bucket.late += 1;
    else if (row.status === "LEAVE") bucket.leave += 1;
    byDate.set(row.date, bucket);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function buildSubjectWise(
  subjectRecords: Array<{ subjectId?: unknown; status: string; date: string }>,
  subjectMap: Map<string, { name: string; code: string }>,
): SubjectAttendanceRow[] {
  const subjectIds = collectValidObjectIds(subjectRecords.map((row) => row.subjectId));
  return subjectIds.map((subjectId) => {
    const rows = subjectRecords.filter((row) => String(row.subjectId) === subjectId);
    const counts = countByStatus(rows);
    const workingDays = new Set(rows.map((row) => row.date)).size;
    const presentLike = counts.present + counts.late;
    const subject = subjectMap.get(subjectId);
    return {
      subjectId,
      subjectName: subject?.name ?? "",
      subjectCode: subject?.code ?? "",
      workingDays,
      present: counts.present,
      absent: counts.absent,
      late: counts.late,
      leave: counts.leave,
      percentage: rows.length ? Math.round((presentLike / rows.length) * 10000) / 100 : 0,
    };
  });
}

export async function getTeacherAllowedSectionIds(ctx: TenantContext) {
  const scopes = await resolveAttendanceScopes(
    ctx.workspaceId,
    ctx.session,
    ctx.permissions,
    ctx.impersonating,
  );
  if (scopes.allAccess) return null;
  const sectionIds = new Set<string>();
  for (const item of scopes.classTeacher) sectionIds.add(item.sectionId);
  for (const item of scopes.subjectTeacher) {
    if (item.sectionId) sectionIds.add(item.sectionId);
  }
  return sectionIds;
}

export async function assertTeacherScopeFilters(ctx: TenantContext, filters: AttendanceScopeFilters) {
  const allowedSections = await getTeacherAllowedSectionIds(ctx);
  if (allowedSections === null) return;

  if (isValidObjectId(filters.sectionId) && !allowedSections.has(filters.sectionId!)) {
    throw new ApiError(403, "Forbidden.");
  }

  if (isValidObjectId(filters.classId) && !filters.sectionId) {
    const sections = await Section.find({
      workspaceId: ctx.workspaceId,
      classId: optionalObjectId(filters.classId),
    })
      .select("_id")
      .lean();
    const hasAllowed = sections.some((row) => allowedSections.has(String(row._id)));
    if (!hasAllowed) throw new ApiError(403, "Forbidden.");
  }
}

export async function resolveScopedStudentIds(ctx: TenantContext, filters: AttendanceScopeFilters) {
  const workspaceId = ctx.workspaceId;

  if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    const linkedIds = (ctx.session.linkedStudentIds ?? []).map(String);
    if (!linkedIds.length) throw new ApiError(403, "Parent account has no linked students.");
    if (filters.studentId) {
      if (!studentIdAllowed(linkedIds, filters.studentId)) throw new ApiError(403, "Forbidden.");
      return [filters.studentId];
    }
    const active =
      ctx.session.linkedStudentId && studentIdAllowed(linkedIds, ctx.session.linkedStudentId)
        ? String(ctx.session.linkedStudentId)
        : linkedIds[0];
    return [active];
  }

  if (isStudentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    const studentId = ctx.session.linkedStudentId;
    if (!studentId) throw new ApiError(403, "Student account is not linked.");
    if (filters.studentId && String(filters.studentId) !== String(studentId)) {
      throw new ApiError(403, "Forbidden.");
    }
    return [String(studentId)];
  }

  await assertTeacherScopeFilters(ctx, filters);

  const studentQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status: "ACTIVE",
  };
  if (optionalObjectId(filters.academicSessionId)) {
    studentQuery.academicSessionId = optionalObjectId(filters.academicSessionId);
  }
  const classOid = optionalObjectId(filters.classId);
  if (classOid) studentQuery.classId = classOid;
  const sectionOid = optionalObjectId(filters.sectionId);
  if (sectionOid) studentQuery.sectionId = sectionOid;
  const studentOid = optionalObjectId(filters.studentId);
  if (studentOid) studentQuery._id = studentOid;

  const allowedSections = await getTeacherAllowedSectionIds(ctx);
  if (allowedSections) {
    if (filters.sectionId) {
      // already validated
    } else if (classOid) {
      const sections = await Section.find({
        workspaceId,
        classId: classOid,
      })
        .select("_id")
        .lean();
      const scoped = sections.map((row) => String(row._id)).filter((id) => allowedSections.has(id));
      studentQuery.sectionId = { $in: scoped.map((id) => new mongoose.Types.ObjectId(id)) };
    } else {
      studentQuery.sectionId = {
        $in: [...allowedSections].map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
  }

  const students = await Student.find(studentQuery).select("_id sectionId").lean();
  const ids = students.map((row) => String(row._id));

  if (filters.studentId && !ids.includes(filters.studentId)) {
    throw new ApiError(403, "Forbidden.");
  }

  if (allowedSections && filters.sectionId && !allowedSections.has(filters.sectionId)) {
    throw new ApiError(403, "Forbidden.");
  }

  return ids;
}

export async function fetchScopedAttendanceRecords(
  ctx: TenantContext,
  filter: ResolvedAttendanceFilter,
  scope: AttendanceScopeFilters,
  studentIds: string[],
) {
  const workspaceId = ctx.workspaceId;
  const attendanceQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    date: { $gte: filter.from, $lte: filter.to },
    studentId: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
  };
  if (scope.subjectId) {
    attendanceQuery.attendanceType = "SUBJECT";
    attendanceQuery.subjectId = new mongoose.Types.ObjectId(scope.subjectId);
  }

  const [classRecords, subjectRecords] = await Promise.all([
    scope.subjectId
      ? Promise.resolve([])
      : Attendance.find({ ...attendanceQuery, attendanceType: "CLASS" }).sort({ date: -1 }).lean(),
    Attendance.find({
      ...attendanceQuery,
      attendanceType: "SUBJECT",
      ...(scope.subjectId ? {} : {}),
    })
      .sort({ date: -1 })
      .lean(),
  ]);

  return { classRecords, subjectRecords };
}

export async function hydrateAttendanceRows(
  ctx: TenantContext,
  classRecords: Array<Record<string, unknown>>,
  subjectRecords: Array<Record<string, unknown>>,
  options?: { includeStudentMeta?: boolean },
) {
  const studentIds = [
    ...new Set(
      [...classRecords, ...subjectRecords]
        .map((row) => String(row.studentId))
        .filter(Boolean),
    ),
  ];
  const subjectIds = collectValidObjectIds(subjectRecords.map((row) => row.subjectId));

  const students = options?.includeStudentMeta
    ? await Student.find({ workspaceId: ctx.workspaceId, _id: { $in: studentIds } }).lean()
    : [];
  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const [classes, sections, subjects] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name code").lean() : [],
  ]);
  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const subjectMap = new Map(subjects.map((row) => [String(row._id), { name: row.name, code: row.code }]));

  const mapRow = (row: Record<string, unknown>): AttendanceRecordRow => {
    const student = studentMap.get(String(row.studentId));
    const subject = row.subjectId ? subjectMap.get(String(row.subjectId)) : null;
    return {
      date: String(row.date),
      studentId: String(row.studentId),
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? "",
      className: student ? classMap.get(String(student.classId)) ?? "" : "",
      sectionName: student ? sectionMap.get(String(student.sectionId)) ?? "" : "",
      status: String(row.status),
      attendanceType: String(row.attendanceType),
      subjectName: subject?.name ?? (row.attendanceType === "SUBJECT" ? "" : "Class"),
      remarks: String(row.remarks ?? ""),
    };
  };

  const records = [...classRecords.map(mapRow), ...subjectRecords.map(mapRow)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return { records, subjectMap, studentMap, classMap, sectionMap };
}

export async function getScopeFilterOptions(ctx: TenantContext) {
  const workspaceId = ctx.workspaceId;
  const allowedSections = await getTeacherAllowedSectionIds(ctx);

  const [sessions, classes, sections, subjects] = await Promise.all([
    AcademicSession.find({ workspaceId }).sort({ name: -1 }).select("name isCurrent").lean(),
    SchoolClass.find({ workspaceId }).sort({ numericName: 1, name: 1 }).select("name").lean(),
    Section.find({ workspaceId }).sort({ name: 1 }).select("name classId").lean(),
    Subject.find({ workspaceId }).sort({ name: 1 }).select("name code classId").lean(),
  ]);

  const scopedSections = allowedSections
    ? sections.filter((row) => allowedSections.has(String(row._id)))
    : sections;
  const allowedClassIds = new Set(scopedSections.map((row) => String(row.classId)));
  const scopedClasses = allowedSections
    ? classes.filter((row) => allowedClassIds.has(String(row._id)))
    : classes;
  const scopedClassIds = new Set(scopedClasses.map((row) => String(row._id)));
  const scopedSubjects = allowedSections
    ? subjects.filter((row) => scopedClassIds.has(String(row.classId)))
    : subjects;

  const studentQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status: "ACTIVE",
  };
  if (allowedSections) {
    studentQuery.sectionId = {
      $in: [...allowedSections].map((id) => new mongoose.Types.ObjectId(id)),
    };
  }
  const students = await Student.find(studentQuery)
    .sort({ name: 1 })
    .select("name admissionNumber classId sectionId academicSessionId")
    .lean();

  return {
    academicSessions: sessions.map((row) => ({
      _id: String(row._id),
      name: row.name,
      isCurrent: Boolean(row.isCurrent),
    })),
    classes: scopedClasses.map((row) => ({ _id: String(row._id), name: row.name })),
    sections: scopedSections.map((row) => ({
      _id: String(row._id),
      name: row.name,
      classId: String(row.classId),
    })),
    subjects: scopedSubjects.map((row) => ({
      _id: String(row._id),
      name: row.name,
      code: row.code,
      classId: String(row.classId),
    })),
    students: students.map((row) => ({
      _id: String(row._id),
      name: row.name,
      admissionNumber: row.admissionNumber,
      classId: String(row.classId),
      sectionId: String(row.sectionId),
      academicSessionId: String(row.academicSessionId ?? ""),
    })),
  };
}

export async function assertStudentViewAccess(ctx: TenantContext, studentId: string) {
  await assertPortalCanViewStudent(ctx, studentId);
}

export type AttendanceViewRole = "admin" | "teacher" | "parent" | "student";

export function resolveViewRole(ctx: TenantContext): AttendanceViewRole {
  if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) return "parent";
  if (isStudentLike(ctx.session.roleSlugs) && !ctx.impersonating) return "student";
  if (isTeacherLike(ctx.session.roleSlugs) && !ctx.impersonating) return "teacher";
  return "admin";
}

export function summarizeClassRecords(records: Array<{ status: string; date: string }>): AttendanceSummary {
  const counts = countByStatus(records);
  const workingDays = new Set(records.map((row) => row.date)).size;
  const presentLike = counts.present + counts.late;
  return {
    workingDays,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    leave: counts.leave,
    percentage: records.length ? Math.round((presentLike / records.length) * 10000) / 100 : 0,
  };
}

export type AttendanceFilterTypeExport = AttendanceFilterType;
