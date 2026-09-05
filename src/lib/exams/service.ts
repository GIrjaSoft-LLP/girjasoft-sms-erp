import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPermission, isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { getTeacherScopes } from "@/lib/attendance/scope";
import {
  assertTeacherScopeAllowed,
  resolveTeacherAssignmentScope,
} from "@/lib/teacher-scope";
import {
  applyFamilyExamVisibility,
  applyTeacherExamScheduleScope,
  formatScheduleDay,
  formatScheduleTime,
  getExamViewerMode,
  resolveLinkedStudentClassScope,
  type ExamViewerMode,
} from "@/lib/exams/access";
import {
  AcademicSession,
  Exam,
  ExamSchedule,
  SchoolClass,
  Section,
  Subject,
} from "@/models/workspace";

export const EXAM_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export type ExamStatus = (typeof EXAM_STATUS_OPTIONS)[number]["value"];

const scheduleInputSchema = z.object({
  _id: z.string().optional(),
  subjectId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
});

export const updateExamInputSchema = z.object({
  name: z.string().trim().min(1),
  classId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]),
  schedules: z.array(scheduleInputSchema).min(1),
});

export type UpdateExamInput = z.infer<typeof updateExamInputSchema>;

export const createExamInputSchema = z.object({
  name: z.string().trim().min(1),
  classId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]),
  schedules: z.array(scheduleInputSchema).min(1),
});

export type CreateExamInput = z.infer<typeof createExamInputSchema>;

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isTeacherExamActor(ctx: TenantContext) {
  return isTeacherLike(ctx.session.roleSlugs) && !ctx.impersonating && !isWorkspaceAdmin(ctx);
}

export function assertExamCreateAllowed(ctx: TenantContext) {
  if (hasPermission(ctx.permissions, "exams.create")) return;

  if (isTeacherExamActor(ctx)) {
    if (!ctx.session.linkedTeacherId) {
      throw new ApiError(403, "Your teacher account is not linked. Contact your administrator.");
    }
    if (hasPermission(ctx.permissions, "exams.view")) return;
  }

  throw new ApiError(403, "Permission denied.");
}

export async function getExamFormOptions(ctx: TenantContext) {
  const workspaceId = ctx.workspaceId;
  const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
  const scope = await resolveTeacherAssignmentScope(ctx);
  const [classes, subjects, sections, currentSession] = await Promise.all([
    SchoolClass.find({ workspaceId: wsObjectId, status: { $ne: "INACTIVE" } })
      .sort({ numericName: 1, name: 1 })
      .select("name")
      .lean(),
    Subject.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
    Section.find({ workspaceId: wsObjectId }).select("name classId").lean(),
    AcademicSession.findOne({ workspaceId: wsObjectId, isCurrent: true }).select("_id name").lean(),
  ]);

  const sectionCountByClass = new Map<string, number>();
  for (const section of sections) {
    const key = String(section.classId);
    sectionCountByClass.set(key, (sectionCountByClass.get(key) ?? 0) + 1);
  }

  return {
    classes: classes
      .filter((row) => !scope.restricted || scope.classIds.has(String(row._id)))
      .map((row) => ({
      _id: String(row._id),
      name: row.name,
      sectionCount: sectionCountByClass.get(String(row._id)) ?? 0,
    })),
    subjects: subjects
      .filter((row) => !scope.restricted || scope.classIds.has(String(row.classId)))
      .map((row) => ({
      _id: String(row._id),
      name: row.name,
      classId: String(row.classId),
    })),
    currentAcademicSessionId: currentSession ? String(currentSession._id) : "",
    statuses: EXAM_STATUS_OPTIONS,
  };
}

export async function createExamWithSchedules(ctx: TenantContext, raw: unknown) {
  const input = createExamInputSchema.parse(raw);
  const workspaceId = ctx.workspaceId;
  const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
  const scope = await resolveTeacherAssignmentScope(ctx);
  assertTeacherScopeAllowed(scope, { classId: input.classId });

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end) throw new ApiError(400, "Invalid start or end date.");
  if (end < start) throw new ApiError(400, "End date cannot be earlier than start date.");

  if (!mongoose.isValidObjectId(input.classId)) {
    throw new ApiError(400, "Invalid class selection.");
  }

  const classDoc = await SchoolClass.findOne({ _id: input.classId, workspaceId: wsObjectId }).lean();
  if (!classDoc) throw new ApiError(400, "Selected class was not found in this workspace.");

  const classSubjects = await Subject.find({ workspaceId: wsObjectId, classId: classDoc._id })
    .select("_id name")
    .lean();
  const subjectMap = new Map(classSubjects.map((row) => [String(row._id), row]));

  const sectionCount = await Section.countDocuments({ workspaceId: wsObjectId, classId: classDoc._id });
  if (!sectionCount) {
    throw new ApiError(400, "The selected class has no sections configured.");
  }

  validateScheduleRows(input.schedules, start, end, subjectMap);

  const currentSession = await AcademicSession.findOne({ workspaceId: wsObjectId, isCurrent: true })
    .select("_id")
    .lean();

  const duplicate = await Exam.findOne({
    workspaceId: wsObjectId,
    classId: classDoc._id,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
  })
    .select("_id")
    .lean();
  if (duplicate) {
    throw new ApiError(400, "An exam with the same name and dates already exists for this class.");
  }

  const exam = await Exam.create({
    workspaceId: wsObjectId,
    name: input.name.trim(),
    classId: classDoc._id,
    academicSessionId: currentSession?._id ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
  });

  await ExamSchedule.insertMany(
    input.schedules.map((row) => ({
      workspaceId: wsObjectId,
      examId: exam._id,
      classId: classDoc._id,
      subjectId: new mongoose.Types.ObjectId(row.subjectId),
      date: row.date,
      startTime: row.startTime,
      endTime: "",
      maxMarks: 100,
    })),
  );

  return {
    examId: String(exam._id),
    name: exam.name,
    className: classDoc.name,
    sectionCount,
    scheduleCount: input.schedules.length,
  };
}

export function assertExamEditAllowed(ctx: TenantContext) {
  if (hasPermission(ctx.permissions, "exams.edit")) return;
  if (isTeacherExamActor(ctx)) {
    if (!ctx.session.linkedTeacherId) {
      throw new ApiError(403, "Your teacher account is not linked. Contact your administrator.");
    }
    if (hasPermission(ctx.permissions, "exams.view")) return;
  }
  throw new ApiError(403, "Permission denied.");
}

function validateScheduleRows(
  schedules: Array<{ subjectId: string; date: string; startTime: string }>,
  start: Date,
  end: Date,
  subjectMap: Map<string, { _id: unknown; name: string }>,
) {
  const seen = new Set<string>();
  for (const row of schedules) {
    if (!mongoose.isValidObjectId(row.subjectId) || !subjectMap.has(row.subjectId)) {
      throw new ApiError(400, "One or more subjects are invalid for the selected class.");
    }
    const scheduleDate = parseDate(row.date);
    if (!scheduleDate) throw new ApiError(400, "Invalid schedule date.");
    if (scheduleDate < start || scheduleDate > end) {
      throw new ApiError(400, "Schedule dates must fall within the exam start and end dates.");
    }
    const key = `${row.subjectId}:${row.date}`;
    if (seen.has(key)) {
      throw new ApiError(400, "Duplicate subject and date schedules are not allowed.");
    }
    seen.add(key);
    if (!row.startTime.trim()) throw new ApiError(400, "Schedule time is required.");
  }
}

export type ExamModuleContext = {
  mode: ExamViewerMode;
  canCreate: boolean;
  canEdit: boolean;
  studentContext?: {
    studentId: string;
    studentName: string;
    classId: string;
    sectionId: string;
    className: string;
    sectionName: string;
  };
  teacherContext?: {
    classId: string;
    sectionId: string;
    className: string;
    sectionName: string;
    subjectName?: string;
  };
};

export async function getExamModuleContext(ctx: TenantContext): Promise<ExamModuleContext> {
  const mode = getExamViewerMode(ctx);
  let canCreate = false;
  let canEdit = false;
  try {
    assertExamCreateAllowed(ctx);
    canCreate = true;
  } catch {
    canCreate = false;
  }
  try {
    assertExamEditAllowed(ctx);
    canEdit = true;
  } catch {
    canEdit = false;
  }

  const base: ExamModuleContext = { mode, canCreate, canEdit };

  if (mode === "parent" || mode === "student") {
    const scope = await resolveLinkedStudentClassScope(ctx);
    if (scope) {
      const [classDoc, sectionDoc] = await Promise.all([
        SchoolClass.findById(scope.classId).select("name").lean(),
        scope.sectionId ? Section.findById(scope.sectionId).select("name").lean() : null,
      ]);
      base.studentContext = {
        ...scope,
        className: classDoc?.name ?? "",
        sectionName: sectionDoc?.name ?? "",
      };
    }
    base.canCreate = false;
    base.canEdit = false;
    return base;
  }

  if (mode === "teacher" && ctx.session.teacherContextClassId && ctx.session.teacherContextSectionId) {
    const [classDoc, sectionDoc] = await Promise.all([
      SchoolClass.findById(ctx.session.teacherContextClassId).select("name").lean(),
      Section.findById(ctx.session.teacherContextSectionId).select("name").lean(),
    ]);
    let subjectName = "";
    if (ctx.session.teacherContextSubjectId) {
      const subject = await Subject.findById(ctx.session.teacherContextSubjectId).select("name").lean();
      subjectName = subject?.name ?? "";
    }
    base.teacherContext = {
      classId: ctx.session.teacherContextClassId,
      sectionId: ctx.session.teacherContextSectionId,
      className: classDoc?.name ?? "",
      sectionName: sectionDoc?.name ?? "",
      subjectName,
    };
  }

  return base;
}

export type ExamScheduleFilters = {
  academicSessionId?: string;
  examId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ExamScheduleRow = {
  _id: string;
  examId: string;
  examName: string;
  classId: string;
  className: string;
  sectionNames: string;
  subjectId: string;
  subjectName: string;
  date: string;
  dayName: string;
  startTime: string;
  timeLabel: string;
  status: string;
};

export async function getExamFilterOptions(ctx: TenantContext) {
  const wsObjectId = new mongoose.Types.ObjectId(ctx.workspaceId);
  const scope = await resolveTeacherAssignmentScope(ctx);
  const familyScope = await resolveLinkedStudentClassScope(ctx);

  const [sessions, exams, classes, sections, subjects] = await Promise.all([
    AcademicSession.find({ workspaceId: wsObjectId }).sort({ isCurrent: -1, name: 1 }).select("name isCurrent").lean(),
    Exam.find({ workspaceId: wsObjectId }).sort({ startDate: -1, name: 1 }).select("name classId academicSessionId").lean(),
    SchoolClass.find({ workspaceId: wsObjectId, status: { $ne: "INACTIVE" } }).sort({ numericName: 1, name: 1 }).select("name").lean(),
    Section.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
    Subject.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
  ]);

  let allowedClassIds = new Set(classes.map((row) => String(row._id)));
  if (scope.restricted) {
    allowedClassIds = scope.classIds;
  }
  if (familyScope) {
    allowedClassIds = new Set([familyScope.classId]);
  }

  const allowedSections = sections.filter((row) => allowedClassIds.has(String(row.classId)));
  let allowedSectionIds = new Set(allowedSections.map((row) => String(row._id)));
  if (familyScope?.sectionId) {
    allowedSectionIds = new Set([familyScope.sectionId]);
  } else if (scope.restricted) {
    allowedSectionIds = scope.sectionIds;
  }

  let allowedSubjectIds = new Set(subjects.map((row) => String(row._id)));
  if (scope.restricted && scope.subjectIds.size) {
    allowedSubjectIds = scope.subjectIds;
  }

  const filteredExams = exams.filter((row) => allowedClassIds.has(String(row.classId)));

  return {
    academicSessions: sessions.map((row) => ({
      _id: String(row._id),
      name: row.name,
      isCurrent: Boolean(row.isCurrent),
    })),
    exams: filteredExams.map((row) => ({
      _id: String(row._id),
      name: row.name,
      classId: String(row.classId),
      academicSessionId: row.academicSessionId ? String(row.academicSessionId) : "",
    })),
    classes: classes
      .filter((row) => allowedClassIds.has(String(row._id)))
      .map((row) => ({ _id: String(row._id), name: row.name })),
    sections: allowedSections
      .filter((row) => allowedSectionIds.has(String(row._id)))
      .map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
    subjects: subjects
      .filter((row) => allowedClassIds.has(String(row.classId)) && allowedSubjectIds.has(String(row._id)))
      .map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
  };
}

export async function listExamScheduleRows(ctx: TenantContext, filters: ExamScheduleFilters) {
  const wsObjectId = new mongoose.Types.ObjectId(ctx.workspaceId);
  const query: Record<string, unknown> = { workspaceId: wsObjectId };

  if (filters.examId) {
    if (!mongoose.isValidObjectId(filters.examId)) throw new ApiError(400, "Invalid exam filter.");
    query.examId = new mongoose.Types.ObjectId(filters.examId);
  }
  if (filters.classId) {
    if (!mongoose.isValidObjectId(filters.classId)) throw new ApiError(400, "Invalid class filter.");
    query.classId = new mongoose.Types.ObjectId(filters.classId);
  }
  if (filters.subjectId) {
    if (!mongoose.isValidObjectId(filters.subjectId)) throw new ApiError(400, "Invalid subject filter.");
    query.subjectId = new mongoose.Types.ObjectId(filters.subjectId);
  }
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, string> = {};
    if (filters.dateFrom) dateFilter.$gte = filters.dateFrom;
    if (filters.dateTo) dateFilter.$lte = filters.dateTo;
    query.date = dateFilter;
  }

  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  if (filters.classId) assertTeacherScopeAllowed(teacherScope, { classId: filters.classId });
  if (filters.sectionId) assertTeacherScopeAllowed(teacherScope, { sectionId: filters.sectionId });
  if (filters.subjectId) assertTeacherScopeAllowed(teacherScope, { subjectId: filters.subjectId });

  await applyFamilyExamVisibility(ctx, "examSchedules", query);

  if (teacherScope.restricted) {
  const classObjectIds = [...teacherScope.classIds].map((id) => new mongoose.Types.ObjectId(id));
    if (filters.classId && !teacherScope.classIds.has(filters.classId)) {
      throw new ApiError(403, "You are not assigned to this class.");
    }
    await applyTeacherExamScheduleScope(ctx, query, classObjectIds);
  } else if (filters.classId) {
    query.classId = new mongoose.Types.ObjectId(filters.classId);
  }

  if (filters.academicSessionId) {
    if (!mongoose.isValidObjectId(filters.academicSessionId)) throw new ApiError(400, "Invalid session filter.");
    const examIds = await Exam.find({
      workspaceId: wsObjectId,
      academicSessionId: new mongoose.Types.ObjectId(filters.academicSessionId),
    }).distinct("_id");
    query.examId = { $in: examIds };
  }

  const schedules = await ExamSchedule.find(query)
    .sort({ date: 1, startTime: 1 })
    .lean();

  const examIds = [...new Set(schedules.map((row) => String(row.examId)))];
  const classIds = [...new Set(schedules.map((row) => String(row.classId)).filter(Boolean))];
  const subjectIds = [...new Set(schedules.map((row) => String(row.subjectId)).filter(Boolean))];

  const [examDocs, classDocs, subjectDocs, sectionDocs] = await Promise.all([
    examIds.length ? Exam.find({ _id: { $in: examIds } }).select("name status classId").lean() : [],
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name").lean() : [],
    classIds.length ? Section.find({ workspaceId: wsObjectId, classId: { $in: classIds } }).select("name classId").lean() : [],
  ]);

  const examMap = new Map(examDocs.map((row) => [String(row._id), row]));
  const classMap = new Map(classDocs.map((row) => [String(row._id), row]));
  const subjectMap = new Map(subjectDocs.map((row) => [String(row._id), row]));
  const sectionsByClass = new Map<string, string[]>();
  for (const section of sectionDocs) {
    const key = String(section.classId);
    const list = sectionsByClass.get(key) ?? [];
    list.push(section.name);
    sectionsByClass.set(key, list);
  }

  const familyScope = await resolveLinkedStudentClassScope(ctx);
  let sectionLabelByClass = sectionsByClass;
  if (familyScope?.sectionId) {
    const section = sectionDocs.find((row) => String(row._id) === familyScope.sectionId);
    if (section) {
      sectionLabelByClass = new Map([[String(section.classId), [section.name]]]);
    }
  } else if (filters.sectionId) {
    const section = sectionDocs.find((row) => String(row._id) === filters.sectionId);
    if (section) {
      sectionLabelByClass = new Map([[String(section.classId), [section.name]]]);
    }
  } else if (teacherScope.restricted && teacherScope.sectionIds.size) {
    const names = sectionDocs
      .filter((row) => teacherScope.sectionIds.has(String(row._id)))
      .reduce<Map<string, string[]>>((map, row) => {
        const key = String(row.classId);
        const list = map.get(key) ?? [];
        list.push(row.name);
        map.set(key, list);
        return map;
      }, new Map());
    if (names.size) sectionLabelByClass = names;
  }

  const rows: ExamScheduleRow[] = [];
  const classTeacherScopes = teacherScope.restricted
    ? await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId ?? "")
    : null;
  const classTeacherClassIds = new Set(classTeacherScopes?.classTeacher.map((item) => item.classId) ?? []);

  for (const row of schedules) {
    const exam = examMap.get(String(row.examId));
    const classId = String(row.classId ?? exam?.classId ?? "");
    const classDoc = classMap.get(classId);
    const subject = subjectMap.get(String(row.subjectId));
    if (teacherScope.restricted && teacherScope.subjectIds.size && row.subjectId) {
      const isClassTeacher = classTeacherClassIds.has(classId);
      if (!isClassTeacher && !teacherScope.subjectIds.has(String(row.subjectId))) continue;
    }
    rows.push({
      _id: String(row._id),
      examId: String(row.examId),
      examName: exam?.name ?? "",
      classId,
      className: classDoc?.name ?? "",
      sectionNames: (sectionLabelByClass.get(classId) ?? []).join(", ") || "—",
      subjectId: row.subjectId ? String(row.subjectId) : "",
      subjectName: subject?.name ?? "",
      date: row.date ?? "",
      dayName: formatScheduleDay(row.date ?? ""),
      startTime: row.startTime ?? "",
      timeLabel: formatScheduleTime(row.startTime ?? ""),
      status: exam?.status ?? "",
    });
  }

  return rows;
}

export async function getExamForEdit(ctx: TenantContext, examId: string) {
  if (!mongoose.isValidObjectId(examId)) throw new ApiError(400, "Invalid exam.");
  const wsObjectId = new mongoose.Types.ObjectId(ctx.workspaceId);
  const exam = await Exam.findOne({ _id: examId, workspaceId: wsObjectId }).lean();
  if (!exam) throw new ApiError(404, "Exam not found.");

  const scope = await resolveTeacherAssignmentScope(ctx);
  assertTeacherScopeAllowed(scope, { classId: exam.classId ? String(exam.classId) : undefined });

  const familyScope = await resolveLinkedStudentClassScope(ctx);
  if (familyScope && exam.classId && String(exam.classId) !== familyScope.classId) {
    throw new ApiError(403, "Forbidden.");
  }

  const schedules = await ExamSchedule.find({ workspaceId: wsObjectId, examId: exam._id })
    .sort({ date: 1, startTime: 1 })
    .lean();

  const classDoc = exam.classId
    ? await SchoolClass.findById(exam.classId).select("name").lean()
    : null;

  return {
    _id: String(exam._id),
    name: exam.name,
    classId: exam.classId ? String(exam.classId) : "",
    className: classDoc?.name ?? "",
    startDate: exam.startDate ?? "",
    endDate: exam.endDate ?? "",
    status: exam.status ?? "DRAFT",
    schedules: schedules.map((row) => ({
      _id: String(row._id),
      subjectId: row.subjectId ? String(row.subjectId) : "",
      date: row.date ?? "",
      startTime: row.startTime ?? "",
    })),
  };
}

export async function updateExamWithSchedules(ctx: TenantContext, examId: string, raw: unknown) {
  assertExamEditAllowed(ctx);
  const input = updateExamInputSchema.parse(raw);
  if (!mongoose.isValidObjectId(examId)) throw new ApiError(400, "Invalid exam.");

  const wsObjectId = new mongoose.Types.ObjectId(ctx.workspaceId);
  const exam = await Exam.findOne({ _id: examId, workspaceId: wsObjectId });
  if (!exam) throw new ApiError(404, "Exam not found.");

  const scope = await resolveTeacherAssignmentScope(ctx);
  assertTeacherScopeAllowed(scope, { classId: input.classId });

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end) throw new ApiError(400, "Invalid start or end date.");
  if (end < start) throw new ApiError(400, "End date cannot be earlier than start date.");

  const classDoc = await SchoolClass.findOne({ _id: input.classId, workspaceId: wsObjectId }).lean();
  if (!classDoc) throw new ApiError(400, "Selected class was not found in this workspace.");

  const classSubjects = await Subject.find({ workspaceId: wsObjectId, classId: classDoc._id })
    .select("_id name")
    .lean();
  const subjectMap = new Map(classSubjects.map((row) => [String(row._id), row]));
  validateScheduleRows(input.schedules, start, end, subjectMap);

  exam.name = input.name.trim();
  exam.classId = classDoc._id;
  exam.startDate = input.startDate;
  exam.endDate = input.endDate;
  exam.status = input.status;
  await exam.save();

  const existing = await ExamSchedule.find({ workspaceId: wsObjectId, examId: exam._id }).lean();
  const existingMap = new Map(existing.map((row) => [String(row._id), row]));
  const keepIds = new Set<string>();

  for (const row of input.schedules) {
    if (row._id && existingMap.has(row._id)) {
      keepIds.add(row._id);
      await ExamSchedule.updateOne(
        { _id: row._id, workspaceId: wsObjectId, examId: exam._id },
        {
          $set: {
            classId: classDoc._id,
            subjectId: new mongoose.Types.ObjectId(row.subjectId),
            date: row.date,
            startTime: row.startTime,
          },
        },
      );
      continue;
    }
    const created = await ExamSchedule.create({
      workspaceId: wsObjectId,
      examId: exam._id,
      classId: classDoc._id,
      subjectId: new mongoose.Types.ObjectId(row.subjectId),
      date: row.date,
      startTime: row.startTime,
      endTime: "",
      maxMarks: 100,
    });
    keepIds.add(String(created._id));
  }

  const removeIds = existing
    .map((row) => String(row._id))
    .filter((id) => !keepIds.has(id));
  if (removeIds.length) {
    await ExamSchedule.deleteMany({
      workspaceId: wsObjectId,
      examId: exam._id,
      _id: { $in: removeIds },
    });
  }

  return {
    examId: String(exam._id),
    name: exam.name,
    scheduleCount: input.schedules.length,
  };
}

export function formatExamStatus(status: string) {
  const match = EXAM_STATUS_OPTIONS.find((row) => row.value === status);
  if (match) return match.label;
  if (status === "ONGOING") return "Active";
  if (status === "SCHEDULED") return "Scheduled";
  return status;
}
