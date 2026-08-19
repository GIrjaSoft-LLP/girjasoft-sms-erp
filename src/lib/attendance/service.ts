import mongoose from "mongoose";
import type { AttendanceStatus, AttendanceType } from "@/config/attendance";
import { ATTENDANCE_STATUSES } from "@/config/attendance";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { assertPortalCanViewStudent, studentIdAllowed } from "@/lib/parent-access";
import { isParentLike, isStudentLike } from "@/lib/rbac";
import { assertScopeAccess, resolveAttendanceScopes } from "@/lib/attendance/scope";
import { getAttendanceSettings } from "@/lib/attendance/settings";
import {
  type AttendanceFilterInput,
  defaultAttendanceFilter,
  resolveAttendanceFilter,
} from "@/lib/attendance/filters";
import {
  buildDailyBreakdown,
  buildSubjectWise,
  fetchScopedAttendanceRecords,
  getScopeFilterOptions,
  hydrateAttendanceRows,
  resolveScopedStudentIds,
  resolveViewRole,
  summarizeClassRecords,
  type AttendanceScopeFilters,
} from "@/lib/attendance/query";
import {
  AcademicSession,
  Attendance,
  AttendanceAudit,
  AttendanceSession,
  SchoolClass,
  Section,
  Student,
  Subject,
} from "@/models/workspace";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function countByStatus(records: Array<{ status: string }>) {
  return {
    present: records.filter((row) => row.status === "PRESENT").length,
    absent: records.filter((row) => row.status === "ABSENT").length,
    late: records.filter((row) => row.status === "LATE").length,
    leave: records.filter((row) => row.status === "LEAVE").length,
  };
}

export async function getCurrentAcademicSessionId(workspaceId: string) {
  const current = await AcademicSession.findOne({ workspaceId, isCurrent: true }).lean();
  return current?._id ? String(current._id) : null;
}

export async function getParentAttendancePortal(ctx: TenantContext, requestedStudentId?: string) {
  const workspaceId = ctx.workspaceId;
  const linkedIds = (ctx.session.linkedStudentIds ?? []).map(String);
  if (!linkedIds.length) {
    throw new ApiError(403, "Parent account has no linked students.");
  }

  const students = await Student.find({
    workspaceId,
    _id: { $in: linkedIds },
    status: "ACTIVE",
  })
    .select("name admissionNumber classId sectionId academicSessionId")
    .sort({ name: 1 })
    .lean();

  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const sessionIds = [...new Set(students.map((row) => String(row.academicSessionId)).filter(Boolean))];
  const [classes, sections, sessions] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
    sessionIds.length ? AcademicSession.find({ _id: { $in: sessionIds } }).select("name").lean() : [],
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const sessionMap = new Map(sessions.map((row) => [String(row._id), row.name]));

  const children = students.map((student) => ({
    _id: String(student._id),
    name: student.name,
    admissionNumber: student.admissionNumber,
    className: classMap.get(String(student.classId)) ?? "",
    sectionName: sectionMap.get(String(student.sectionId)) ?? "",
    academicSessionName: sessionMap.get(String(student.academicSessionId)) ?? "",
  }));

  if (requestedStudentId && !studentIdAllowed(linkedIds, requestedStudentId)) {
    throw new ApiError(403, "Forbidden.");
  }

  const activeStudentId =
    requestedStudentId ??
    (ctx.session.linkedStudentId && studentIdAllowed(linkedIds, ctx.session.linkedStudentId)
      ? String(ctx.session.linkedStudentId)
      : linkedIds[0]);

  await assertPortalCanViewStudent(ctx, activeStudentId);
  const summary = await getStudentAttendanceSummary(ctx, activeStudentId);
  const activeChild = children.find((child) => child._id === activeStudentId) ?? children[0];

  return {
    role: "parent" as const,
    children,
    activeStudentId,
    activeChild,
    ...summary,
  };
}

export async function getStudentAttendancePortal(ctx: TenantContext) {
  const studentId = ctx.session.linkedStudentId;
  if (!studentId) throw new ApiError(403, "Student account is not linked.");
  await assertPortalCanViewStudent(ctx, studentId);
  const summary = await getStudentAttendanceSummary(ctx, studentId);
  return {
    role: "student" as const,
    activeStudentId: studentId,
    ...summary,
  };
}

export async function getAttendanceDashboard(ctx: TenantContext, options?: { studentId?: string }) {
  if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    return getParentAttendancePortal(ctx, options?.studentId);
  }
  if (isStudentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
    return getStudentAttendancePortal(ctx);
  }

  const workspaceId = ctx.workspaceId;
  const date = todayIso();
  const settings = await getAttendanceSettings(workspaceId);
  const scopes = await resolveAttendanceScopes(workspaceId, ctx.session, ctx.permissions, ctx.impersonating);

  const studentQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status: "ACTIVE",
  };

  const attendanceQuery: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    date,
    attendanceType: "CLASS",
  };

  if (!scopes.allAccess && scopes.classTeacher.length) {
    const sectionIds = scopes.classTeacher.map((item) => new mongoose.Types.ObjectId(item.sectionId));
    studentQuery.sectionId = { $in: sectionIds };
    attendanceQuery.sectionId = { $in: sectionIds };
  } else if (!scopes.allAccess && !scopes.subjectTeacher.length) {
    return {
      role: "admin" as const,
      stats: {
        totalStudents: 0,
        presentToday: 0,
        absentToday: 0,
        lateToday: 0,
        leaveToday: 0,
        attendancePercent: 0,
        pendingAttendance: 0,
      },
      classWise: [],
      scopes,
      settings,
    };
  }

  const [totalStudents, records, sections, classes, sessions] = await Promise.all([
    Student.countDocuments(studentQuery),
    Attendance.find(attendanceQuery).lean(),
    Section.find({ workspaceId }).lean(),
    SchoolClass.find({ workspaceId }).select("name numericName").lean(),
    AttendanceSession.find({ workspaceId, date, attendanceType: "CLASS" }).lean(),
  ]);

  const counts = countByStatus(records);
  const markedSections = new Set(sessions.map((row) => String(row.sectionId)));
  const classMap = new Map(classes.map((row) => [String(row._id), row]));
  const classWise = sections
    .map((section) => {
      const sectionRecords = records.filter((row) => String(row.sectionId) === String(section._id));
      const sectionCounts = countByStatus(sectionRecords);
      const classDoc = classMap.get(String(section.classId));
      const total = sectionRecords.length;
      const presentLike = sectionCounts.present + sectionCounts.late;
      return {
        classId: String(section.classId),
        sectionId: String(section._id),
        className: classDoc?.name ?? "",
        sectionName: section.name,
        totalStudents: total,
        present: presentLike,
        absent: sectionCounts.absent,
        late: sectionCounts.late,
        leave: sectionCounts.leave,
        percent: total ? Math.round((presentLike / total) * 100) : 0,
        marked: markedSections.has(String(section._id)),
      };
    })
    .filter((row) => row.totalStudents > 0 || row.marked)
    .sort((a, b) => (classMap.get(a.classId)?.numericName ?? 0) - (classMap.get(b.classId)?.numericName ?? 0));

  const presentLike = counts.present + counts.late;
  return {
    role: "admin" as const,
    stats: {
      totalStudents,
      presentToday: counts.present,
      absentToday: counts.absent,
      lateToday: counts.late,
      leaveToday: counts.leave,
      attendancePercent: totalStudents ? Math.round((presentLike / totalStudents) * 100) : 0,
      pendingAttendance: Math.max(0, sections.length - markedSections.size),
    },
    classWise,
    scopes,
    settings,
  };
}

export async function getAttendanceRoster(
  ctx: TenantContext,
  input: {
    date: string;
    classId: string;
    sectionId: string;
    attendanceType: AttendanceType;
    subjectId?: string | null;
    academicSessionId?: string | null;
  },
) {
  const workspaceId = ctx.workspaceId;
  const settings = await getAttendanceSettings(workspaceId);
  const scopes = await resolveAttendanceScopes(workspaceId, ctx.session, ctx.permissions, ctx.impersonating);
  assertScopeAccess(scopes, input);

  if (input.attendanceType === "CLASS" && !settings.enableClassAttendance) {
    throw new ApiError(400, "Class attendance is disabled.");
  }
  if (input.attendanceType === "SUBJECT" && !settings.enableSubjectAttendance) {
    throw new ApiError(400, "Subject-wise attendance is disabled.");
  }
  if (input.attendanceType === "SUBJECT" && !input.subjectId) {
    throw new ApiError(400, "Subject is required for subject attendance.");
  }

  const academicSessionId =
    input.academicSessionId ?? (await getCurrentAcademicSessionId(workspaceId));

  const sessionQuery = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    date: input.date,
    classId: new mongoose.Types.ObjectId(input.classId),
    sectionId: new mongoose.Types.ObjectId(input.sectionId),
    attendanceType: input.attendanceType,
    subjectId:
      input.attendanceType === "SUBJECT" && input.subjectId
        ? new mongoose.Types.ObjectId(input.subjectId)
        : null,
    ...(academicSessionId ? { academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } : {}),
  };

  const [students, session, records] = await Promise.all([
    Student.find({
      workspaceId,
      classId: input.classId,
      sectionId: input.sectionId,
      status: "ACTIVE",
    })
      .sort({ name: 1 })
      .lean(),
    AttendanceSession.findOne(sessionQuery).lean(),
    Attendance.find({
      workspaceId,
      date: input.date,
      classId: input.classId,
      sectionId: input.sectionId,
      attendanceType: input.attendanceType,
      ...(input.attendanceType === "SUBJECT" && input.subjectId
        ? { subjectId: input.subjectId }
        : { subjectId: null }),
    }).lean(),
  ]);

  const recordMap = new Map(records.map((row) => [String(row.studentId), row]));

  return {
    session,
    locked: Boolean(session && session.status === "SUBMITTED" && settings.lockAfterSubmit),
    students: students.map((student, index) => {
      const existing = recordMap.get(String(student._id));
      return {
        _id: String(student._id),
        serial: index + 1,
        name: student.name,
        admissionNumber: student.admissionNumber,
        status: (existing?.status ?? "PRESENT") as AttendanceStatus,
        remarks: existing?.remarks ?? "",
        attendanceId: existing?._id ? String(existing._id) : null,
      };
    }),
    academicSessionId,
  };
}

export async function saveAttendanceMarking(
  ctx: TenantContext,
  input: {
    date: string;
    classId: string;
    sectionId: string;
    attendanceType: AttendanceType;
    subjectId?: string | null;
    academicSessionId?: string | null;
    records: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
    submit?: boolean;
    reason?: string;
  },
) {
  const workspaceId = ctx.workspaceId;
  const settings = await getAttendanceSettings(workspaceId);
  const scopes = await resolveAttendanceScopes(workspaceId, ctx.session, ctx.permissions, ctx.impersonating);
  assertScopeAccess(scopes, input);

  if (!ATTENDANCE_STATUSES.includes(input.records[0]?.status as AttendanceStatus) && input.records.length) {
    // validated per record below
  }

  for (const record of input.records) {
    if (!ATTENDANCE_STATUSES.includes(record.status)) {
      throw new ApiError(400, `Invalid attendance status: ${record.status}`);
    }
  }

  const academicSessionId =
    input.academicSessionId ?? (await getCurrentAcademicSessionId(workspaceId));
  const subjectObjectId =
    input.attendanceType === "SUBJECT" && input.subjectId
      ? new mongoose.Types.ObjectId(input.subjectId)
      : null;

  const sessionFilter = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    date: input.date,
    classId: new mongoose.Types.ObjectId(input.classId),
    sectionId: new mongoose.Types.ObjectId(input.sectionId),
    attendanceType: input.attendanceType,
    subjectId: subjectObjectId,
    ...(academicSessionId ? { academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } : {}),
  };

  let session = await AttendanceSession.findOne(sessionFilter);
  const isAdmin = scopes.allAccess;

  if (session?.status === "SUBMITTED" && settings.lockAfterSubmit && !isAdmin && !settings.allowTeacherEdit) {
    throw new ApiError(409, "Attendance already marked for this class/section/date.");
  }

  const counts = countByStatus(input.records);
  const markedAt = new Date();

  if (!session) {
    session = await AttendanceSession.create({
      ...sessionFilter,
      teacherId: ctx.session.linkedTeacherId ? new mongoose.Types.ObjectId(ctx.session.linkedTeacherId) : null,
      status: input.submit === false ? "DRAFT" : "SUBMITTED",
      markedBy: ctx.session.sub,
      markedByEmail: ctx.session.email,
      markedAt,
      totalStudents: input.records.length,
      presentCount: counts.present,
      absentCount: counts.absent,
      lateCount: counts.late,
      leaveCount: counts.leave,
    });
  } else {
    session.status = input.submit === false ? "DRAFT" : "SUBMITTED";
    session.markedBy = ctx.session.sub;
    session.markedByEmail = ctx.session.email;
    session.markedAt = markedAt;
    session.totalStudents = input.records.length;
    session.presentCount = counts.present;
    session.absentCount = counts.absent;
    session.lateCount = counts.late;
    session.leaveCount = counts.leave;
    await session.save();
  }

  for (const record of input.records) {
    const filter = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      studentId: new mongoose.Types.ObjectId(record.studentId),
      date: input.date,
      attendanceType: input.attendanceType,
      subjectId: subjectObjectId,
    };

    const existing = await Attendance.findOne(filter);
    if (existing && existing.status !== record.status) {
      await AttendanceAudit.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        attendanceId: existing._id,
        sessionId: session._id,
        studentId: existing.studentId,
        previousStatus: existing.status,
        newStatus: record.status,
        reason: input.reason ?? "",
        changedBy: ctx.session.sub,
        changedByEmail: ctx.session.email,
      });
    }

    await Attendance.findOneAndUpdate(
      filter,
      {
        $set: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          academicSessionId: academicSessionId ? new mongoose.Types.ObjectId(academicSessionId) : null,
          studentId: new mongoose.Types.ObjectId(record.studentId),
          classId: new mongoose.Types.ObjectId(input.classId),
          sectionId: new mongoose.Types.ObjectId(input.sectionId),
          subjectId: subjectObjectId,
          sessionId: session._id,
          date: input.date,
          attendanceType: input.attendanceType,
          status: record.status,
          remarks: record.remarks ?? "",
          markedBy: ctx.session.sub,
          markedAt,
        },
      },
      { upsert: true, new: true },
    );
  }

  return { session, message: "Attendance saved successfully." };
}

export async function getAttendanceRegister(
  ctx: TenantContext,
  filters: {
    from?: string;
    to?: string;
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    attendanceType?: AttendanceType | "";
    status?: string;
  },
) {
  const workspaceId = ctx.workspaceId;
  const query: Record<string, unknown> = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  if (filters.classId) query.classId = new mongoose.Types.ObjectId(filters.classId);
  if (filters.sectionId) query.sectionId = new mongoose.Types.ObjectId(filters.sectionId);
  if (filters.subjectId) query.subjectId = new mongoose.Types.ObjectId(filters.subjectId);
  if (filters.attendanceType) query.attendanceType = filters.attendanceType;
  if (filters.status) query.status = filters.status;

  const sessions = await AttendanceSession.find(query).sort({ date: -1 }).limit(500).lean();
  const classIds = [...new Set(sessions.map((row) => String(row.classId)))];
  const sectionIds = [...new Set(sessions.map((row) => String(row.sectionId)))];
  const subjectIds = [...new Set(sessions.map((row) => String(row.subjectId)).filter(Boolean))];
  const [classes, sections, subjects] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name").lean() : [],
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const subjectMap = new Map(subjects.map((row) => [String(row._id), row.name]));

  return sessions.map((row) => ({
    _id: String(row._id),
    date: row.date,
    className: classMap.get(String(row.classId)) ?? "",
    sectionName: sectionMap.get(String(row.sectionId)) ?? "",
    subjectName: row.subjectId ? subjectMap.get(String(row.subjectId)) ?? "" : "—",
    attendanceType: row.attendanceType,
    present: row.presentCount ?? 0,
    absent: row.absentCount ?? 0,
    late: row.lateCount ?? 0,
    leave: row.leaveCount ?? 0,
    status: row.status,
  }));
}

export type AttendanceViewParams = AttendanceFilterInput &
  AttendanceScopeFilters & {
    studentId?: string;
  };

export async function getAttendanceView(ctx: TenantContext, params: AttendanceViewParams = {}) {
  const filter = resolveAttendanceFilter({
    filterType: params.filterType,
    date: params.date,
    weekStart: params.weekStart,
    month: params.month,
  });

  const scopeFilters: AttendanceScopeFilters = {
    academicSessionId: params.academicSessionId,
    classId: params.classId,
    sectionId: params.sectionId,
    studentId: params.studentId,
    subjectId: params.subjectId,
  };

  const role = resolveViewRole(ctx);
  const studentIds = await resolveScopedStudentIds(ctx, scopeFilters);
  if (!studentIds.length) {
    return {
      role,
      filter,
      classSummary: {
        workingDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        percentage: 0,
      },
      subjectWise: [],
      dailyBreakdown: [],
      records: [],
      scopeOptions: role === "parent" || role === "student" ? undefined : await getScopeFilterOptions(ctx),
      children: role === "parent" ? await getParentChildrenMeta(ctx) : undefined,
      activeStudentId: studentIds[0] ?? params.studentId,
    };
  }

  const { classRecords, subjectRecords } = await fetchScopedAttendanceRecords(
    ctx,
    filter,
    scopeFilters,
    studentIds,
  );

  const includeStudentMeta = role === "admin" || role === "teacher" || studentIds.length > 1;
  const { records, subjectMap } = await hydrateAttendanceRows(ctx, classRecords, subjectRecords, {
    includeStudentMeta,
  });

  const classSummary = summarizeClassRecords(
    classRecords.map((row) => ({ status: String(row.status), date: String(row.date) })),
  );
  const subjectWise = buildSubjectWise(
    subjectRecords.map((row) => ({
      subjectId: row.subjectId,
      status: String(row.status),
      date: String(row.date),
    })),
    subjectMap,
  );
  const dailyBreakdown = buildDailyBreakdown(
    classRecords.map((row) => ({ date: String(row.date), status: String(row.status) })),
  );

  let studentMeta:
    | { _id: string; name: string; admissionNumber: string; className: string; sectionName: string }
    | undefined;
  if (studentIds.length === 1) {
    const student = await Student.findOne({ _id: studentIds[0], workspaceId: ctx.workspaceId }).lean();
    if (student) {
      const [classDoc, sectionDoc] = await Promise.all([
        student.classId ? SchoolClass.findById(student.classId).select("name").lean() : null,
        student.sectionId ? Section.findById(student.sectionId).select("name").lean() : null,
      ]);
      studentMeta = {
        _id: String(student._id),
        name: student.name,
        admissionNumber: student.admissionNumber,
        className: classDoc?.name ?? "",
        sectionName: sectionDoc?.name ?? "",
      };
    }
  }

  const response: Record<string, unknown> = {
    role,
    filter,
    student: studentMeta,
    classSummary,
    subjectWise,
    dailyBreakdown,
    records,
    activeStudentId: studentIds.length === 1 ? studentIds[0] : params.studentId,
  };

  if (role === "parent") {
    response.children = await getParentChildrenMeta(ctx);
  } else if (role === "admin" || role === "teacher") {
    response.scopeOptions = await getScopeFilterOptions(ctx);
    response.scopeFilters = scopeFilters;
    const currentSessionId = await getCurrentAcademicSessionId(ctx.workspaceId);
    response.defaults = {
      filter: defaultAttendanceFilter(),
      academicSessionId: params.academicSessionId ?? currentSessionId ?? "",
    };
  }

  return response;
}

async function getParentChildrenMeta(ctx: TenantContext) {
  const workspaceId = ctx.workspaceId;
  const linkedIds = (ctx.session.linkedStudentIds ?? []).map(String);
  const students = await Student.find({
    workspaceId,
    _id: { $in: linkedIds },
    status: "ACTIVE",
  })
    .select("name admissionNumber classId sectionId academicSessionId")
    .sort({ name: 1 })
    .lean();
  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const sessionIds = [...new Set(students.map((row) => String(row.academicSessionId)).filter(Boolean))];
  const [classes, sections, sessions] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
    sessionIds.length ? AcademicSession.find({ _id: { $in: sessionIds } }).select("name").lean() : [],
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const sessionMap = new Map(sessions.map((row) => [String(row._id), row.name]));
  return students.map((student) => ({
    _id: String(student._id),
    name: student.name,
    admissionNumber: student.admissionNumber,
    className: classMap.get(String(student.classId)) ?? "",
    sectionName: sectionMap.get(String(student.sectionId)) ?? "",
    academicSessionName: sessionMap.get(String(student.academicSessionId)) ?? "",
  }));
}

export async function getStudentAttendanceSummary(
  ctx: TenantContext,
  studentId: string,
  params: AttendanceFilterInput = {},
) {
  await assertPortalCanViewStudent(ctx, studentId);
  const view = await getAttendanceView(ctx, { ...params, studentId });
  return {
    filter: view.filter,
    student: view.student,
    classSummary: view.classSummary,
    subjectWise: view.subjectWise,
    dailyBreakdown: view.dailyBreakdown,
    recent: view.records,
  };
}

export async function getLowAttendanceReport(ctx: TenantContext, threshold?: number) {
  const workspaceId = ctx.workspaceId;
  const settings = await getAttendanceSettings(workspaceId);
  const minPercent = threshold ?? settings.lowAttendanceThreshold;

  const students = await Student.find({ workspaceId, status: "ACTIVE" }).lean();
  const records = await Attendance.find({ workspaceId, attendanceType: "CLASS" }).lean();
  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));

  const rows = students
    .map((student) => {
      const studentRecords = records.filter((row) => String(row.studentId) === String(student._id));
      const summary = countByStatus(studentRecords);
      const workingDays = studentRecords.length;
      const presentLike = summary.present + summary.late;
      const percentage = workingDays ? Math.round((presentLike / workingDays) * 10000) / 100 : 0;
      return {
        studentId: String(student._id),
        studentName: student.name,
        admissionNumber: student.admissionNumber,
        className: classMap.get(String(student.classId)) ?? "",
        sectionName: sectionMap.get(String(student.sectionId)) ?? "",
        percentage,
        workingDays,
      };
    })
    .filter((row) => row.workingDays > 0 && row.percentage < minPercent)
    .sort((a, b) => a.percentage - b.percentage);

  return { threshold: minPercent, rows };
}

export async function getDailyAttendanceReport(ctx: TenantContext, date?: string) {
  const workspaceId = ctx.workspaceId;
  const targetDate = date ?? todayIso();
  const sessions = await AttendanceSession.find({
    workspaceId,
    date: targetDate,
    attendanceType: "CLASS",
  }).lean();
  const classIds = [...new Set(sessions.map((row) => String(row.classId)))];
  const sectionIds = [...new Set(sessions.map((row) => String(row.sectionId)))];
  const [classes, sections] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));

  const rows = sessions.map((row) => {
    const total = row.totalStudents ?? 0;
    const presentLike = (row.presentCount ?? 0) + (row.lateCount ?? 0);
    return {
      className: classMap.get(String(row.classId)) ?? "",
      sectionName: sectionMap.get(String(row.sectionId)) ?? "",
      totalStudents: total,
      present: row.presentCount ?? 0,
      absent: row.absentCount ?? 0,
      late: row.lateCount ?? 0,
      leave: row.leaveCount ?? 0,
      percentage: total ? Math.round((presentLike / total) * 10000) / 100 : 0,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      totalStudents: acc.totalStudents + row.totalStudents,
      present: acc.present + row.present,
      absent: acc.absent + row.absent,
      late: acc.late + row.late,
      leave: acc.leave + row.leave,
    }),
    { totalStudents: 0, present: 0, absent: 0, late: 0, leave: 0 },
  );
  const overall =
    totals.totalStudents > 0
      ? Math.round(((totals.present + totals.late) / totals.totalStudents) * 10000) / 100
      : 0;

  return { date: targetDate, totals, overall, rows };
}

export async function getStatusStudentReport(
  ctx: TenantContext,
  status: AttendanceStatus,
  filters?: { from?: string; to?: string; attendanceType?: AttendanceType },
) {
  const workspaceId = ctx.workspaceId;
  const query: Record<string, unknown> = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status,
    attendanceType: filters?.attendanceType ?? "CLASS",
  };
  if (filters?.from || filters?.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const records = await Attendance.find(query).sort({ date: -1 }).limit(1000).lean();
  const studentIds = [...new Set(records.map((row) => String(row.studentId)))];
  const students = await Student.find({ _id: { $in: studentIds } }).lean();
  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const classIds = [...new Set(students.map((row) => String(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId)).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    SchoolClass.find({ _id: { $in: classIds } }).select("name").lean(),
    Section.find({ _id: { $in: sectionIds } }).select("name").lean(),
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));

  const rows = records.map((row) => {
    const student = studentMap.get(String(row.studentId));
    return {
      date: row.date,
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? "",
      className: student ? classMap.get(String(student.classId)) ?? "" : "",
      sectionName: student ? sectionMap.get(String(student.sectionId)) ?? "" : "",
      status: row.status,
      remarks: row.remarks ?? "",
    };
  });

  return { status, rows };
}

export async function getMonthlyAttendanceReport(ctx: TenantContext, month?: string) {
  const workspaceId = ctx.workspaceId;
  const targetMonth = month ?? todayIso().slice(0, 7);
  const sessions = await AttendanceSession.find({
    workspaceId,
    date: { $regex: `^${targetMonth}` },
    attendanceType: "CLASS",
  }).lean();

  const byDate = new Map<string, { present: number; absent: number; late: number; leave: number; total: number }>();
  for (const row of sessions) {
    const bucket = byDate.get(row.date) ?? { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    bucket.present += row.presentCount ?? 0;
    bucket.absent += row.absentCount ?? 0;
    bucket.late += row.lateCount ?? 0;
    bucket.leave += row.leaveCount ?? 0;
    bucket.total += row.totalStudents ?? 0;
    byDate.set(row.date, bucket);
  }

  const rows = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, counts]) => ({
      date,
      ...counts,
      percentage: counts.total ? Math.round(((counts.present + counts.late) / counts.total) * 10000) / 100 : 0,
    }));

  return { month: targetMonth, rows };
}
