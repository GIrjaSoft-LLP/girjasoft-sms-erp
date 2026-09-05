import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPermission } from "@/lib/rbac";
import { resolveLinkedStudentClassScope } from "@/lib/exams/access";
import { resolveTeacherAssignmentScope } from "@/lib/teacher-scope";
import {
  DEFAULT_GRADE_CRITERIA,
  normalizeGradeCriteria,
  ratingForPercentage,
  roundMarks,
  validateGradeCriteria,
  type GradeBand,
} from "@/lib/marks/grades";
import { getTeacherScopes } from "@/lib/attendance/scope";
import {
  assertMarksCriteriaAllowed,
  assertMarksMutationAllowed,
  assertTeacherCanScore,
  getMarksViewerMode,
  isMarksReadOnlyActor,
  teacherAllowedSubjectIds,
} from "@/lib/marks/access";
import {
  AcademicSession,
  Exam,
  ExamSchedule,
  Mark,
  Result,
  SchoolClass,
  Section,
  Settings,
  Student,
  StudentEnrollment,
  Subject,
} from "@/models/workspace";

const markRowSchema = z.object({
  subjectId: z.string().min(1),
  maxMarks: z.number().positive(),
  marksObtained: z.number().min(0),
});

export const saveStudentMarksSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  rows: z.array(markRowSchema).min(1),
});

export const saveClassSubjectMarksSchema = z.object({
  examId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  maxMarks: z.number().positive(),
  rows: z
    .array(
      z.object({
        studentId: z.string().min(1),
        marksObtained: z.number().min(0),
      }),
    )
    .min(1),
});

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function getGradeCriteria(workspaceId: string): Promise<GradeBand[]> {
  const settings = await Settings.findOne({ workspaceId }).select("examination").lean();
  const examination = (settings?.examination ?? {}) as { gradeCriteria?: unknown; passingPercentage?: number };
  return normalizeGradeCriteria(examination.gradeCriteria);
}

async function getPassingPercentage(workspaceId: string) {
  const settings = await Settings.findOne({ workspaceId }).select("examination").lean();
  const examination = (settings?.examination ?? {}) as { passingPercentage?: number };
  const value = Number(examination.passingPercentage ?? 33);
  return Number.isFinite(value) ? value : 33;
}

export async function getMarksModuleContext(ctx: TenantContext) {
  const mode = getMarksViewerMode(ctx);
  return {
    mode,
    canCreate: !isMarksReadOnlyActor(ctx) && (hasPermission(ctx.permissions, "marks.create") || ctx.impersonating),
    canEdit: !isMarksReadOnlyActor(ctx) && (hasPermission(ctx.permissions, "marks.edit") || ctx.impersonating),
    canConfigureCriteria: !isMarksReadOnlyActor(ctx) && (mode === "admin" || mode === "teacher"),
    gradeCriteria: await getGradeCriteria(ctx.workspaceId),
  };
}

export async function getMarksFilterOptions(ctx: TenantContext) {
  const wsObjectId = oid(ctx.workspaceId);
  const scope = await resolveTeacherAssignmentScope(ctx);
  const family = await resolveLinkedStudentClassScope(ctx);

  const [exams, classes, sections, students, subjects] = await Promise.all([
    Exam.find({ workspaceId: wsObjectId }).sort({ startDate: -1, name: 1 }).select("name classId").lean(),
    SchoolClass.find({ workspaceId: wsObjectId, status: { $ne: "INACTIVE" } })
      .sort({ numericName: 1, name: 1 })
      .select("name")
      .lean(),
    Section.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
    Student.find({ workspaceId: wsObjectId, status: { $ne: "INACTIVE" } })
      .sort({ name: 1 })
      .select("name classId sectionId")
      .lean(),
    Subject.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
  ]);

  let classIds = new Set(classes.map((row) => String(row._id)));
  let sectionIds = new Set(sections.map((row) => String(row._id)));
  if (scope.restricted) {
    classIds = scope.classIds;
    sectionIds = scope.sectionIds;
  }
  if (family) {
    classIds = new Set([family.classId]);
    sectionIds = family.sectionId ? new Set([family.sectionId]) : sectionIds;
  }

  return {
    exams: exams
      .filter((row) => !row.classId || classIds.has(String(row.classId)))
      .map((row) => ({ _id: String(row._id), name: row.name, classId: row.classId ? String(row.classId) : "" })),
    classes: classes.filter((row) => classIds.has(String(row._id))).map((row) => ({ _id: String(row._id), name: row.name })),
    sections: sections
      .filter((row) => classIds.has(String(row.classId)) && sectionIds.has(String(row._id)))
      .map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
    students: students
      .filter((row) => classIds.has(String(row.classId ?? "")) && (!row.sectionId || sectionIds.has(String(row.sectionId))))
      .map((row) => ({
        _id: String(row._id),
        name: row.name,
        classId: row.classId ? String(row.classId) : "",
        sectionId: row.sectionId ? String(row.sectionId) : "",
      })),
    subjects: await filterTeacherSubjects(
      ctx,
      subjects
        .filter((row) => classIds.has(String(row.classId)))
        .map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
    ),
  };
}

async function filterTeacherSubjects(
  ctx: TenantContext,
  subjects: Array<{ _id: string; name: string; classId: string }>,
) {
  const scope = await resolveTeacherAssignmentScope(ctx);
  if (!scope.restricted || !ctx.session.linkedTeacherId) return subjects;
  const scopes = await getTeacherScopes(ctx.workspaceId, ctx.session.linkedTeacherId);
  const classTeacherClassIds = new Set(scopes.classTeacher.map((row) => row.classId));
  return subjects.filter((row) => classTeacherClassIds.has(row.classId) || scope.subjectIds.has(row._id));
}

export async function examSubjects(workspaceId: string, examId: string, classId: string) {
  const schedules = await ExamSchedule.find({
    workspaceId: oid(workspaceId),
    examId: oid(examId),
    classId: oid(classId),
  })
    .select("subjectId maxMarks")
    .lean();
  if (schedules.length) {
    const ids = schedules.map((row) => row.subjectId).filter(Boolean);
    const subjects = ids.length
      ? await Subject.find({ workspaceId: oid(workspaceId), _id: { $in: ids } }).select("name classId").lean()
      : [];
    const map = new Map(subjects.map((row) => [String(row._id), row]));
    return schedules
      .filter((row) => row.subjectId && map.has(String(row.subjectId)))
      .map((row) => ({
        _id: String(row.subjectId),
        name: map.get(String(row.subjectId))?.name ?? "",
        maxMarks: Number(row.maxMarks || 100),
      }));
  }
  const subjects = await Subject.find({ workspaceId: oid(workspaceId), classId }).sort({ name: 1 }).select("name").lean();
  return subjects.map((row) => ({ _id: String(row._id), name: row.name, maxMarks: 100 }));
}

async function assertStudentInClass(workspaceId: string, studentId: string, classId: string, sectionId: string) {
  const student = await Student.findOne({ _id: studentId, workspaceId: oid(workspaceId) })
    .select("name classId sectionId")
    .lean();
  if (!student) throw new ApiError(404, "Student not found.");
  if (String(student.classId) !== classId) throw new ApiError(400, "Student does not belong to the selected class.");
  if (sectionId && student.sectionId && String(student.sectionId) !== sectionId) {
    throw new ApiError(400, "Student does not belong to the selected section.");
  }
  return student;
}

export async function getStudentMarksEntry(
  ctx: TenantContext,
  examId: string,
  classId: string,
  sectionId: string,
  studentId: string,
) {
  if (isMarksReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(studentId)) {
    throw new ApiError(400, "Invalid exam or student.");
  }
  await assertTeacherCanScore(ctx, { classId, sectionId });
  const family = await resolveLinkedStudentClassScope(ctx);
  if (family && family.studentId !== studentId) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  const [exam, classDoc, sectionDoc, student] = await Promise.all([
    Exam.findOne({ _id: examId, workspaceId: oid(ctx.workspaceId) }).select("name classId").lean(),
    SchoolClass.findOne({ _id: classId, workspaceId: oid(ctx.workspaceId) }).select("name").lean(),
    Section.findOne({ _id: sectionId, workspaceId: oid(ctx.workspaceId) }).select("name classId").lean(),
    assertStudentInClass(ctx.workspaceId, studentId, classId, sectionId),
  ]);
  if (!exam) throw new ApiError(404, "Exam not found.");
  if (exam.classId && String(exam.classId) !== classId) {
    throw new ApiError(400, "Selected class is not part of this exam.");
  }
  if (!classDoc || !sectionDoc) throw new ApiError(400, "Invalid class or section.");

  let subjects = await examSubjects(ctx.workspaceId, examId, classId);
  const allowedSubjects = await teacherAllowedSubjectIds(ctx, classId, sectionId);
  if (allowedSubjects) subjects = subjects.filter((row) => allowedSubjects.has(row._id));

  const existing = await Mark.find({
    workspaceId: oid(ctx.workspaceId),
    examId: oid(examId),
    studentId: oid(studentId),
  }).lean();
  const markMap = new Map(existing.map((row) => [String(row.subjectId), row]));

  return {
    examName: exam.name,
    className: classDoc.name,
    sectionName: sectionDoc.name,
    studentName: student.name,
    rows: subjects.map((subject) => {
      const mark = markMap.get(subject._id);
      return {
        subjectId: subject._id,
        subjectName: subject.name,
        maxMarks: Number(mark?.maxMarks ?? subject.maxMarks),
        marksObtained: mark ? Number(mark.marksObtained) : "",
      };
    }),
  };
}

export async function getClassSubjectEntry(
  ctx: TenantContext,
  examId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
) {
  if (isMarksReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  await assertTeacherCanScore(ctx, { classId, sectionId, subjectId });
  const [exam, classDoc, sectionDoc, subject, students] = await Promise.all([
    Exam.findOne({ _id: examId, workspaceId: oid(ctx.workspaceId) }).select("name classId").lean(),
    SchoolClass.findOne({ _id: classId, workspaceId: oid(ctx.workspaceId) }).select("name").lean(),
    Section.findOne({ _id: sectionId, workspaceId: oid(ctx.workspaceId) }).select("name").lean(),
    Subject.findOne({ _id: subjectId, workspaceId: oid(ctx.workspaceId), classId }).select("name").lean(),
    Student.find({
      workspaceId: oid(ctx.workspaceId),
      classId,
      sectionId,
      status: { $ne: "INACTIVE" },
    })
      .sort({ name: 1 })
      .select("name")
      .lean(),
  ]);
  if (!exam || !classDoc || !sectionDoc || !subject) throw new ApiError(400, "Invalid exam, class or subject.");

  const subjects = await examSubjects(ctx.workspaceId, examId, classId);
  const subjectMeta = subjects.find((row) => row._id === subjectId);
  const existing = await Mark.find({
    workspaceId: oid(ctx.workspaceId),
    examId: oid(examId),
    subjectId: oid(subjectId),
    studentId: { $in: students.map((row) => row._id) },
  }).lean();
  const markMap = new Map(existing.map((row) => [String(row.studentId), row]));

  return {
    examName: exam.name,
    className: classDoc.name,
    sectionName: sectionDoc.name,
    subjectName: subject.name,
    maxMarks: Number(subjectMeta?.maxMarks ?? existing[0]?.maxMarks ?? 100),
    rows: students.map((student) => {
      const mark = markMap.get(String(student._id));
      return {
        studentId: String(student._id),
        studentName: student.name,
        marksObtained: mark ? Number(mark.marksObtained) : "",
      };
    }),
  };
}

export async function upsertMarkAndGrade(
  ctx: TenantContext,
  examId: string,
  studentId: string,
  subjectId: string,
  maxMarks: number,
  marksObtained: number,
  criteria: GradeBand[],
) {
  if (marksObtained > maxMarks) {
    throw new ApiError(400, "Gained marks cannot be greater than total marks.");
  }
  const subjectPercent = roundMarks((marksObtained / maxMarks) * 100);
  await Mark.findOneAndUpdate(
    {
      workspaceId: oid(ctx.workspaceId),
      examId: oid(examId),
      studentId: oid(studentId),
      subjectId: oid(subjectId),
    },
    {
      $set: {
        workspaceId: oid(ctx.workspaceId),
        examId: oid(examId),
        studentId: oid(studentId),
        subjectId: oid(subjectId),
        maxMarks,
        marksObtained,
        grade: ratingForPercentage(subjectPercent, criteria),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function recalculateStudentResult(ctx: TenantContext, examId: string, studentId: string) {
  const [marks, criteria, passing] = await Promise.all([
    Mark.find({ workspaceId: oid(ctx.workspaceId), examId: oid(examId), studentId: oid(studentId) }).lean(),
    getGradeCriteria(ctx.workspaceId),
    getPassingPercentage(ctx.workspaceId),
  ]);
  const totalMarks = roundMarks(marks.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0));
  const gainedMarks = roundMarks(marks.reduce((sum, row) => sum + Number(row.marksObtained || 0), 0));
  const percentage = totalMarks > 0 ? roundMarks((gainedMarks / totalMarks) * 100) : 0;
  const grade = ratingForPercentage(percentage, criteria);
  const status = percentage >= passing ? "PASS" : "FAIL";

  await Result.findOneAndUpdate(
    { workspaceId: oid(ctx.workspaceId), examId: oid(examId), studentId: oid(studentId) },
    {
      $set: {
        workspaceId: oid(ctx.workspaceId),
        examId: oid(examId),
        studentId: oid(studentId),
        totalMarks,
        gainedMarks,
        percentage,
        grade,
        status,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return { totalMarks, gainedMarks, percentage, rating: grade, status };
}

export async function saveStudentMarks(ctx: TenantContext, raw: unknown) {
  assertMarksMutationAllowed(ctx);
  const input = saveStudentMarksSchema.parse(raw);
  await assertTeacherCanScore(ctx, { classId: input.classId, sectionId: input.sectionId });
  await assertStudentInClass(ctx.workspaceId, input.studentId, input.classId, input.sectionId);
  const exam = await Exam.findOne({ _id: input.examId, workspaceId: oid(ctx.workspaceId) }).select("classId").lean();
  if (!exam) throw new ApiError(404, "Exam not found.");
  if (exam.classId && String(exam.classId) !== input.classId) {
    throw new ApiError(400, "Selected class is not part of this exam.");
  }

  const allowedSubjects = await teacherAllowedSubjectIds(ctx, input.classId, input.sectionId);
  const criteria = await getGradeCriteria(ctx.workspaceId);
  for (const row of input.rows) {
    if (allowedSubjects && !allowedSubjects.has(row.subjectId)) {
      throw new ApiError(403, "You are not assigned to one or more subjects.");
    }
    await upsertMarkAndGrade(ctx, input.examId, input.studentId, row.subjectId, row.maxMarks, row.marksObtained, criteria);
  }
  return recalculateStudentResult(ctx, input.examId, input.studentId);
}

export async function saveClassSubjectMarks(ctx: TenantContext, raw: unknown) {
  assertMarksMutationAllowed(ctx);
  const input = saveClassSubjectMarksSchema.parse(raw);
  await assertTeacherCanScore(ctx, {
    classId: input.classId,
    sectionId: input.sectionId,
    subjectId: input.subjectId,
  });
  const criteria = await getGradeCriteria(ctx.workspaceId);
  for (const row of input.rows) {
    await assertStudentInClass(ctx.workspaceId, row.studentId, input.classId, input.sectionId);
    await upsertMarkAndGrade(
      ctx,
      input.examId,
      row.studentId,
      input.subjectId,
      input.maxMarks,
      row.marksObtained,
      criteria,
    );
    await recalculateStudentResult(ctx, input.examId, row.studentId);
  }
  return { saved: input.rows.length };
}

export async function listMarkSummaries(
  ctx: TenantContext,
  filters: { examId?: string; classId?: string; sectionId?: string; studentId?: string; subjectId?: string },
) {
  const query: Record<string, unknown> = { workspaceId: oid(ctx.workspaceId) };
  if (filters.examId) query.examId = oid(filters.examId);
  if (filters.studentId) query.studentId = oid(filters.studentId);
  if (filters.subjectId) query.subjectId = oid(filters.subjectId);

  const family = await resolveLinkedStudentClassScope(ctx);
  if (family) query.studentId = oid(family.studentId);

  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  if (teacherScope.restricted) {
    if (filters.classId) await assertTeacherCanScore(ctx, { classId: filters.classId, sectionId: filters.sectionId });
    const studentQuery: Record<string, unknown> = {
      workspaceId: oid(ctx.workspaceId),
      sectionId: { $in: [...teacherScope.sectionIds].map((id) => oid(id)) },
    };
    if (filters.classId) studentQuery.classId = oid(filters.classId);
    if (filters.sectionId) studentQuery.sectionId = oid(filters.sectionId);
    const studentIds = await Student.find(studentQuery).distinct("_id");
    query.studentId = { $in: studentIds };
  } else if (filters.classId || filters.sectionId) {
    const studentQuery: Record<string, unknown> = { workspaceId: oid(ctx.workspaceId) };
    if (filters.classId) studentQuery.classId = oid(filters.classId);
    if (filters.sectionId) studentQuery.sectionId = oid(filters.sectionId);
    const studentIds = await Student.find(studentQuery).distinct("_id");
    query.studentId = { $in: studentIds };
  }

  const marks = await Mark.find(query).lean();
  const grouped = new Map<string, typeof marks>();
  for (const mark of marks) {
    const key = `${mark.examId}:${mark.studentId}`;
    const list = grouped.get(key) ?? [];
    list.push(mark);
    grouped.set(key, list);
  }

  const examIds = [...new Set([...grouped.keys()].map((key) => key.split(":")[0]))];
  const studentIds = [...new Set([...grouped.keys()].map((key) => key.split(":")[1]))];
  const [exams, students, criteria] = await Promise.all([
    examIds.length ? Exam.find({ _id: { $in: examIds } }).select("name").lean() : [],
    studentIds.length
      ? Student.find({ _id: { $in: studentIds } }).select("name classId sectionId").lean()
      : [],
    getGradeCriteria(ctx.workspaceId),
  ]);
  const classIds = [...new Set(students.map((row) => String(row.classId ?? "")).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => String(row.sectionId ?? "")).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
  ]);

  const examMap = new Map(exams.map((row) => [String(row._id), row]));
  const studentMap = new Map(students.map((row) => [String(row._id), row]));
  const classMap = new Map(classes.map((row) => [String(row._id), row]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row]));

  return [...grouped.entries()].map(([key, rows]) => {
    const [examId, studentId] = key.split(":");
    const student = studentMap.get(studentId);
    const totalMarks = roundMarks(rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0));
    const gainedMarks = roundMarks(rows.reduce((sum, row) => sum + Number(row.marksObtained || 0), 0));
    const percentage = totalMarks > 0 ? roundMarks((gainedMarks / totalMarks) * 100) : 0;
    return {
      examId,
      studentId,
      examName: examMap.get(examId)?.name ?? "",
      studentName: student?.name ?? "",
      className: classMap.get(String(student?.classId ?? ""))?.name ?? "",
      sectionName: sectionMap.get(String(student?.sectionId ?? ""))?.name ?? "",
      totalMarks,
      gainedMarks,
      percentage,
      rating: ratingForPercentage(percentage, criteria),
    };
  });
}

export async function getExamResultView(ctx: TenantContext, examId: string, studentId?: string) {
  const family = await resolveLinkedStudentClassScope(ctx);
  const resolvedStudentId = family?.studentId || studentId || "";
  if (!resolvedStudentId || !mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(resolvedStudentId)) {
    throw new ApiError(400, "Invalid exam or student.");
  }
  if (family && resolvedStudentId !== family.studentId) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  const [exam, student, marks, criteria, passing] = await Promise.all([
    Exam.findOne({ _id: examId, workspaceId: oid(ctx.workspaceId) })
      .select("name academicSessionId")
      .lean(),
    Student.findOne({ _id: resolvedStudentId, workspaceId: oid(ctx.workspaceId) })
      .select("name classId sectionId admissionNumber currentEnrollmentId academicSessionId")
      .lean(),
    Mark.find({
      workspaceId: oid(ctx.workspaceId),
      examId: oid(examId),
      studentId: oid(resolvedStudentId),
    }).lean(),
    getGradeCriteria(ctx.workspaceId),
    getPassingPercentage(ctx.workspaceId),
  ]);
  if (!exam || !student) throw new ApiError(404, "Result not found.");
  if (!family) {
    await assertTeacherCanScore(ctx, {
      classId: student.classId ? String(student.classId) : undefined,
      sectionId: student.sectionId ? String(student.sectionId) : undefined,
    });
  }

  const subjectIds = marks.map((row) => row.subjectId).filter(Boolean);
  const sessionId = exam.academicSessionId || student.academicSessionId;
  const [subjects, classDoc, sectionDoc, sessionDoc, enrollment, resultDoc] = await Promise.all([
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name").lean() : [],
    student.classId ? SchoolClass.findById(student.classId).select("name").lean() : null,
    student.sectionId ? Section.findById(student.sectionId).select("name").lean() : null,
    sessionId ? AcademicSession.findById(sessionId).select("name").lean() : null,
    StudentEnrollment.findOne({
      workspaceId: oid(ctx.workspaceId),
      studentId: oid(resolvedStudentId),
      $or: [{ isCurrent: true }, ...(sessionId ? [{ academicSessionId: sessionId }] : [])],
    })
      .sort({ isCurrent: -1 })
      .select("rollNumber")
      .lean(),
    Result.findOne({
      workspaceId: oid(ctx.workspaceId),
      examId: oid(examId),
      studentId: oid(resolvedStudentId),
    })
      .select("status grade percentage totalMarks gainedMarks")
      .lean(),
  ]);
  const subjectMap = new Map(subjects.map((row) => [String(row._id), row]));

  const rows = marks.map((row) => {
    const maxMarks = Number(row.maxMarks || 0);
    const marksObtained = Number(row.marksObtained || 0);
    const subjectPercent = maxMarks > 0 ? roundMarks((marksObtained / maxMarks) * 100) : 0;
    return {
      subjectName: subjectMap.get(String(row.subjectId))?.name ?? "",
      maxMarks,
      marksObtained,
      percentage: subjectPercent,
      grade: row.grade || ratingForPercentage(subjectPercent, criteria),
    };
  });
  const totalMarks = roundMarks(rows.reduce((sum, row) => sum + row.maxMarks, 0));
  const gainedMarks = roundMarks(rows.reduce((sum, row) => sum + row.marksObtained, 0));
  const percentage = totalMarks > 0 ? roundMarks((gainedMarks / totalMarks) * 100) : 0;
  const rating = resultDoc?.grade || ratingForPercentage(percentage, criteria);
  const status = resultDoc?.status || (percentage >= passing ? "PASS" : "FAIL");

  return {
    resultId: resultDoc ? String(resultDoc._id) : "",
    examName: exam.name,
    examType: "",
    academicSessionName: sessionDoc?.name ?? "",
    admissionNumber: student.admissionNumber ?? "",
    rollNumber: enrollment?.rollNumber ?? "",
    studentName: student.name,
    className: classDoc?.name ?? "",
    sectionName: sectionDoc?.name ?? "",
    rows,
    totalMarks,
    gainedMarks,
    percentage,
    rating,
    status,
    generatedAt: new Date().toISOString(),
  };
}

export async function listParentExams(ctx: TenantContext) {
  const family = await resolveLinkedStudentClassScope(ctx);
  if (!family) return { studentName: "", className: "", sectionName: "", exams: [] };

  const [classDoc, sectionDoc, marks, exams] = await Promise.all([
    SchoolClass.findById(family.classId).select("name").lean(),
    family.sectionId ? Section.findById(family.sectionId).select("name").lean() : null,
    Mark.find({ workspaceId: oid(ctx.workspaceId), studentId: oid(family.studentId) }).lean(),
    Exam.find({
      workspaceId: oid(ctx.workspaceId),
      $or: [{ classId: oid(family.classId) }, { classId: null }],
    })
      .sort({ startDate: -1, name: 1 })
      .select("name")
      .lean(),
  ]);

  const criteria = await getGradeCriteria(ctx.workspaceId);
  const byExam = new Map<string, typeof marks>();
  for (const mark of marks) {
    const key = String(mark.examId);
    const list = byExam.get(key) ?? [];
    list.push(mark);
    byExam.set(key, list);
  }

  return {
    studentName: family.studentName,
    className: classDoc?.name ?? "",
    sectionName: sectionDoc?.name ?? "",
    exams: exams.map((exam) => {
      const rows = byExam.get(String(exam._id)) ?? [];
      const totalMarks = roundMarks(rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0));
      const gainedMarks = roundMarks(rows.reduce((sum, row) => sum + Number(row.marksObtained || 0), 0));
      const percentage = totalMarks > 0 ? roundMarks((gainedMarks / totalMarks) * 100) : 0;
      return {
        examId: String(exam._id),
        examName: exam.name,
        hasMarks: rows.length > 0,
        totalMarks,
        gainedMarks,
        percentage,
        rating: rows.length ? ratingForPercentage(percentage, criteria) : "",
      };
    }),
  };
}

export async function getGradeCriteriaForWorkspace(ctx: TenantContext) {
  return { items: await getGradeCriteria(ctx.workspaceId) };
}

export async function saveGradeCriteria(ctx: TenantContext, raw: unknown) {
  assertMarksCriteriaAllowed(ctx);
  const parsed = z
    .array(z.object({ min: z.number(), max: z.number(), rating: z.string().trim().min(1) }))
    .parse(raw);
  const items = validateGradeCriteria(parsed);
  await Settings.findOneAndUpdate(
    { workspaceId: oid(ctx.workspaceId) },
    { $set: { "examination.gradeCriteria": items } },
    { upsert: true },
  );
  return { items };
}
