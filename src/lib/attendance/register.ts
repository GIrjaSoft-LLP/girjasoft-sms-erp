import mongoose from "mongoose";
import type { TenantContext } from "@/lib/api/guards";
import { formatDateLabel } from "@/lib/attendance/filters";
import { collectValidObjectIds, isValidObjectId, optionalObjectId } from "@/lib/attendance/object-id";
import {
  getScopeFilterOptions,
  resolveScopedStudentIds,
  resolveViewRole,
  type AttendanceScopeFilters,
} from "@/lib/attendance/query";
import { User } from "@/models/identity";
import {
  AcademicSession,
  Attendance,
  SchoolClass,
  Section,
  Student,
  StudentEnrollment,
  Subject,
} from "@/models/workspace";

export type RegisterFilterInput = AttendanceScopeFilters & {
  from?: string;
  to?: string;
};

export type RegisterSummary = {
  totalStudents: number;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

export type RegisterClassSummaryRow = {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  students: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
};

export type RegisterDetailRow = {
  _id: string;
  date: string;
  classId: string;
  sectionId: string;
  academicSessionName: string;
  className: string;
  sectionName: string;
  subjectName: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  status: string;
  attendanceType: string;
  markedBy: string;
  markedAt: string;
  remarks: string;
};

export type RegisterReport = {
  role: ReturnType<typeof resolveViewRole>;
  summary: RegisterSummary;
  classSummary: RegisterClassSummaryRow[];
  records: RegisterDetailRow[];
  scopeOptions?: Awaited<ReturnType<typeof getScopeFilterOptions>>;
  meta: {
    from: string;
    to: string;
    academicSessionName: string;
    className: string;
    sectionName: string;
    subjectName: string;
  };
};

function emptySummary(): RegisterSummary {
  return {
    totalStudents: 0,
    totalRecords: 0,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    percentage: 0,
  };
}

function countStatuses(records: Array<{ status: string }>) {
  return {
    present: records.filter((row) => row.status === "PRESENT").length,
    absent: records.filter((row) => row.status === "ABSENT").length,
    late: records.filter((row) => row.status === "LATE").length,
    leave: records.filter((row) => row.status === "LEAVE").length,
  };
}

function percentageFromCounts(counts: { present: number; late: number }, total: number) {
  if (!total) return 0;
  return Math.round(((counts.present + counts.late) / total) * 10000) / 100;
}

export async function getAttendanceRegisterReport(
  ctx: TenantContext,
  filters: RegisterFilterInput,
): Promise<RegisterReport> {
  const workspaceId = ctx.workspaceId;
  const role = resolveViewRole(ctx);
  const scopeOptions = role === "admin" || role === "teacher" ? await getScopeFilterOptions(ctx) : undefined;

  const scopeFilters: AttendanceScopeFilters = {
    academicSessionId: isValidObjectId(filters.academicSessionId) ? filters.academicSessionId : undefined,
    classId: isValidObjectId(filters.classId) ? filters.classId : undefined,
    sectionId: isValidObjectId(filters.sectionId) ? filters.sectionId : undefined,
    studentId: isValidObjectId(filters.studentId) ? filters.studentId : undefined,
    subjectId: isValidObjectId(filters.subjectId) ? filters.subjectId : undefined,
  };

  const studentIds = await resolveScopedStudentIds(ctx, scopeFilters);
  if (!studentIds.length) {
    return {
      role,
      summary: emptySummary(),
      classSummary: [],
      records: [],
      scopeOptions,
      meta: await buildMeta(ctx, filters, scopeOptions),
    };
  }

  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    studentId: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
  };

  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const classOid = optionalObjectId(filters.classId);
  if (classOid) query.classId = classOid;
  const sectionOid = optionalObjectId(filters.sectionId);
  if (sectionOid) query.sectionId = sectionOid;
  const sessionOid = optionalObjectId(filters.academicSessionId);
  if (sessionOid) query.academicSessionId = sessionOid;
  const subjectOid = optionalObjectId(filters.subjectId);
  if (subjectOid) {
    query.subjectId = subjectOid;
    query.attendanceType = "SUBJECT";
  }

  const rows = await Attendance.find(query).sort({ date: -1, classId: 1, sectionId: 1 }).limit(5000).lean();

  const studentIdSet = collectValidObjectIds(rows.map((row) => row.studentId));
  const classIds = collectValidObjectIds(rows.map((row) => row.classId));
  const sectionIds = collectValidObjectIds(rows.map((row) => row.sectionId));
  const subjectIds = collectValidObjectIds(rows.map((row) => row.subjectId));
  const sessionIds = collectValidObjectIds(rows.map((row) => row.academicSessionId));
  const markerIds = collectValidObjectIds(rows.map((row) => row.markedBy));

  const [students, classes, sections, subjects, sessions, markers, enrollments] = await Promise.all([
    Student.find({ workspaceId, _id: { $in: studentIdSet } })
      .select("name admissionNumber classId sectionId currentEnrollmentId")
      .lean(),
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name").lean() : [],
    sessionIds.length ? AcademicSession.find({ _id: { $in: sessionIds } }).select("name").lean() : [],
    markerIds.length ? User.find({ _id: { $in: markerIds } }).select("name email").lean() : [],
    StudentEnrollment.find({ workspaceId, studentId: { $in: studentIdSet }, isCurrent: true })
      .select("studentId rollNumber")
      .lean(),
  ]);

  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));
  const sessionMap = new Map(sessions.map((row) => [String(row._id), row.name]));
  const markerMap = new Map(markers.map((row) => [String(row._id), row.name || row.email]));
  const rollMap = new Map(enrollments.map((row) => [String(row.studentId), row.rollNumber ?? ""]));

  const records: RegisterDetailRow[] = rows.map((row) => {
    const student = studentMap.get(String(row.studentId));
    const classId = String(row.classId ?? student?.classId ?? "");
    const sectionId = String(row.sectionId ?? student?.sectionId ?? "");
    return {
      _id: String(row._id),
      date: row.date,
      academicSessionName: row.academicSessionId ? sessionMap.get(String(row.academicSessionId)) ?? "" : "",
      className: classMap.get(classId) ?? "",
      sectionName: sectionMap.get(sectionId) ?? "",
      subjectName: row.subjectId
        ? subjectMap.get(String(row.subjectId)) ?? ""
        : row.attendanceType === "SUBJECT"
          ? ""
          : "Class",
      studentId: String(row.studentId),
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? "",
      rollNumber: rollMap.get(String(row.studentId)) ?? "",
      status: row.status,
      attendanceType: row.attendanceType,
      markedBy: row.markedBy ? markerMap.get(String(row.markedBy)) ?? "" : "",
      markedAt: row.markedAt ? new Date(row.markedAt).toISOString() : "",
      remarks: row.remarks ?? "",
    };
  });

  const counts = countStatuses(records);
  const summary: RegisterSummary = {
    totalStudents: new Set(records.map((row) => row.studentId)).size,
    totalRecords: records.length,
    ...counts,
    percentage: percentageFromCounts(counts, records.length),
  };

  const classGroups = new Map<
    string,
    { classId: string; sectionId: string; className: string; sectionName: string; rows: RegisterDetailRow[] }
  >();
  records.forEach((detail, index) => {
    const source = rows[index];
    const classId = String(source?.classId ?? "");
    const sectionId = String(source?.sectionId ?? "");
    const key = `${classId}::${sectionId}`;
    const bucket = classGroups.get(key) ?? {
      classId,
      sectionId,
      className: detail.className,
      sectionName: detail.sectionName,
      rows: [],
    };
    bucket.rows.push(detail);
    classGroups.set(key, bucket);
  });

  const classSummary: RegisterClassSummaryRow[] = [...classGroups.values()]
    .map((group) => {
      const groupCounts = countStatuses(group.rows);
      return {
        classId: group.classId,
        sectionId: group.sectionId,
        className: group.className,
        sectionName: group.sectionName,
        students: new Set(group.rows.map((item) => item.studentId)).size,
        ...groupCounts,
        percentage: percentageFromCounts(groupCounts, group.rows.length),
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName));

  return {
    role,
    summary,
    classSummary,
    records,
    scopeOptions,
    meta: await buildMeta(ctx, filters, scopeOptions, {
      classMap,
      sectionMap,
      subjectMap,
      sessionMap,
    }),
  };
}

async function buildMeta(
  ctx: TenantContext,
  filters: RegisterFilterInput,
  scopeOptions?: Awaited<ReturnType<typeof getScopeFilterOptions>>,
  maps?: {
    classMap?: Map<string, string>;
    sectionMap?: Map<string, string>;
    subjectMap?: Map<string, string>;
    sessionMap?: Map<string, string>;
  },
) {
  const sessionName =
    scopeOptions?.academicSessions.find((row) => row._id === filters.academicSessionId)?.name ??
    (isValidObjectId(filters.academicSessionId)
      ? ((await AcademicSession.findById(filters.academicSessionId).select("name").lean())?.name ?? "")
      : "All Sessions");

  const className =
    scopeOptions?.classes.find((row) => row._id === filters.classId)?.name ??
    (isValidObjectId(filters.classId) ? maps?.classMap?.get(filters.classId!) ?? "" : "All Classes");

  const sectionName =
    scopeOptions?.sections.find((row) => row._id === filters.sectionId)?.name ??
    (isValidObjectId(filters.sectionId) ? maps?.sectionMap?.get(filters.sectionId!) ?? "" : "All Sections");

  const subjectName =
    scopeOptions?.subjects.find((row) => row._id === filters.subjectId)?.name ??
    (isValidObjectId(filters.subjectId) ? maps?.subjectMap?.get(filters.subjectId!) ?? "" : "All Subjects");

  return {
    from: filters.from ? formatDateLabel(filters.from) : "",
    to: filters.to ? formatDateLabel(filters.to) : "",
    academicSessionName: sessionName || "All Sessions",
    className: className || "All Classes",
    sectionName: sectionName || "All Sections",
    subjectName: subjectName || "All Subjects",
  };
}

export function registerRowsForExport(report: RegisterReport) {
  return report.records.map((row) => ({
    Date: row.date,
    "Academic Session": row.academicSessionName,
    Class: row.className,
    Section: row.sectionName,
    Subject: row.subjectName,
    "Student ID": row.studentId,
    "Admission No": row.admissionNumber,
    "Roll No": row.rollNumber,
    "Student Name": row.studentName,
    Status: row.status,
    "Marked By": row.markedBy,
    "Marked At": row.markedAt,
    Remarks: row.remarks,
  }));
}
