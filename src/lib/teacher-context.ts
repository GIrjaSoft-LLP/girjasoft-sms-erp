import mongoose from "mongoose";
import { ApiError, type TenantContext } from "@/lib/api/guards";
import { getTeacherScopes } from "@/lib/attendance/scope";
import { isTeacherLike } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";
import { User } from "@/models/identity";
import { SchoolClass, Section, Subject, Timetable } from "@/models/workspace";

export type TeacherAssignment = {
  kind: "CLASS" | "SUBJECT";
  classId: string;
  sectionId: string;
  subjectId?: string;
  className: string;
  sectionName: string;
  subjectName?: string;
  label: string;
};

function localTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getTeacherAssignmentOptions(workspaceId: string, teacherId: string) {
  const scopes = await getTeacherScopes(workspaceId, teacherId);
  const assignments: TeacherAssignment[] = [
    ...scopes.classTeacher.map((item) => ({
      kind: "CLASS" as const,
      classId: item.classId,
      sectionId: item.sectionId,
      className: item.className,
      sectionName: item.sectionName,
      label: `${item.className}-${item.sectionName}`,
    })),
    ...scopes.subjectTeacher.map((item) => ({
      kind: "SUBJECT" as const,
      classId: item.classId,
      sectionId: item.sectionId,
      subjectId: item.subjectId,
      className: item.className,
      sectionName: item.sectionName,
      subjectName: item.subjectName,
      label: `${item.className}-${item.sectionName} · ${item.subjectName}`,
    })),
  ];

  const unique = new Map<string, TeacherAssignment>();
  for (const item of assignments) {
    const key = `${item.classId}:${item.sectionId}:${item.subjectId ?? ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return { assignments: [...unique.values()] };
}

export function buildTeacherClassSummaryFromAssignments(assignments: TeacherAssignment[]) {
  const map = new Map<
    string,
    {
      classId: string;
      className: string;
      sections: Map<string, string>;
      subjects: Map<string, string>;
    }
  >();

  for (const item of assignments) {
    const bucket =
      map.get(item.classId) ??
      ({
        classId: item.classId,
        className: item.className,
        sections: new Map<string, string>(),
        subjects: new Map<string, string>(),
      } as const);
    if (item.sectionId && item.sectionName) {
      bucket.sections.set(item.sectionId, item.sectionName);
    }
    if (item.subjectId && item.subjectName) {
      bucket.subjects.set(item.subjectId, item.subjectName);
    }
    map.set(item.classId, bucket);
  }

  return [...map.values()]
    .map((row) => ({
      classId: row.classId,
      className: row.className,
      sections: [...row.sections.entries()].map(([sectionId, name]) => ({ sectionId, name })),
      subjects: [...row.subjects.entries()].map(([subjectId, name]) => ({ subjectId, name })),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

export async function assertTeacherAssignmentAllowed(
  workspaceId: string,
  teacherId: string,
  input: { classId: string; sectionId: string; subjectId?: string | null },
) {
  const { assignments } = await getTeacherAssignmentOptions(workspaceId, teacherId);
  const matching = assignments.filter(
    (item) => item.classId === input.classId && item.sectionId === input.sectionId,
  );
  if (!matching.length) {
    throw new ApiError(403, "You are not assigned to this class/section.");
  }

  if (input.subjectId) {
    if (!matching.some((item) => item.subjectId === input.subjectId)) {
      throw new ApiError(403, "You are not assigned to this subject.");
    }
    return;
  }

  if (matching.some((item) => item.kind === "CLASS")) {
    return;
  }

  if (matching.some((item) => item.subjectId)) {
    throw new ApiError(400, "Please select a subject for this class/section.");
  }
}

export async function getTodayTimetableSuggestions(workspaceId: string, teacherId: string) {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const rows = await Timetable.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    day,
  }).lean();

  const classIds = [...new Set(rows.map((row) => String(row.classId)))];
  const sectionIds = [...new Set(rows.map((row) => String(row.sectionId)).filter(Boolean))];
  const subjectIds = [...new Set(rows.map((row) => String(row.subjectId)).filter(Boolean))];

  const [classes, sections, subjects] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select("name").lean() : [],
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name code").lean() : [],
  ]);

  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const subjectMap = new Map(subjects.map((row) => [String(row._id), row]));

  return rows.map((row) => ({
    period: row.period,
    classId: String(row.classId),
    sectionId: String(row.sectionId ?? ""),
    subjectId: row.subjectId ? String(row.subjectId) : "",
    className: classMap.get(String(row.classId)) ?? "",
    sectionName: sectionMap.get(String(row.sectionId)) ?? "",
    subjectName: row.subjectId ? subjectMap.get(String(row.subjectId))?.name ?? "" : "",
  }));
}

export async function loadTeacherContextFromUser(userId: string) {
  const user = await User.findById(userId)
    .select(
      "teacherContextClassId teacherContextSectionId teacherContextSubjectId teacherContextDate linkedTeacherId",
    )
    .lean();
  if (!user?.linkedTeacherId) return null;
  return {
    teacherId: String(user.linkedTeacherId),
    classId: user.teacherContextClassId ? String(user.teacherContextClassId) : "",
    sectionId: user.teacherContextSectionId ? String(user.teacherContextSectionId) : "",
    subjectId: user.teacherContextSubjectId ? String(user.teacherContextSubjectId) : "",
    date: user.teacherContextDate ?? "",
  };
}

export async function saveTeacherContext(
  userId: string,
  workspaceId: string,
  teacherId: string,
  input: { classId: string; sectionId: string; subjectId?: string | null },
) {
  await assertTeacherAssignmentAllowed(workspaceId, teacherId, input);
  const today = localTodayIso();
  await User.findByIdAndUpdate(userId, {
    $set: {
      teacherContextClassId: new mongoose.Types.ObjectId(input.classId),
      teacherContextSectionId: new mongoose.Types.ObjectId(input.sectionId),
      teacherContextSubjectId: input.subjectId ? new mongoose.Types.ObjectId(input.subjectId) : null,
      teacherContextDate: today,
    },
  });
}

export function attachTeacherContextToSession(
  session: SessionPayload,
  context: { classId: string; sectionId: string; subjectId: string },
) {
  return {
    ...session,
    teacherContextClassId: context.classId || null,
    teacherContextSectionId: context.sectionId || null,
    teacherContextSubjectId: context.subjectId || null,
  };
}

export async function enrichTeacherSession(session: SessionPayload, _workspaceId: string) {
  if (!isTeacherLike(session.roleSlugs) || !session.sub) return session;
  const user = await User.findById(session.sub)
    .select(
      "teacherContextClassId teacherContextSectionId teacherContextSubjectId teacherContextDate linkedTeacherId",
    )
    .lean();
  if (!user) return session;
  const today = localTodayIso();
  const contextValid = user.teacherContextDate === today;
  return {
    ...session,
    linkedTeacherId: user.linkedTeacherId ? String(user.linkedTeacherId) : session.linkedTeacherId,
    teacherContextClassId:
      contextValid && user.teacherContextClassId ? String(user.teacherContextClassId) : null,
    teacherContextSectionId:
      contextValid && user.teacherContextSectionId ? String(user.teacherContextSectionId) : null,
    teacherContextSubjectId:
      contextValid && user.teacherContextSubjectId ? String(user.teacherContextSubjectId) : null,
  };
}

export function teacherNeedsContextSelection(session: SessionPayload) {
  if (!isTeacherLike(session.roleSlugs)) return false;
  if (!session.linkedTeacherId) return false;
  return !session.teacherContextClassId || !session.teacherContextSectionId;
}

export async function hydrateTeacherContextLabels(
  workspaceId: string,
  context: { classId: string; sectionId: string; subjectId?: string | null },
) {
  const [classDoc, sectionDoc, subjectDoc] = await Promise.all([
    context.classId ? SchoolClass.findOne({ _id: context.classId, workspaceId }).select("name").lean() : null,
    context.sectionId ? Section.findOne({ _id: context.sectionId, workspaceId }).select("name").lean() : null,
    context.subjectId ? Subject.findOne({ _id: context.subjectId, workspaceId }).select("name").lean() : null,
  ]);
  return {
    className: classDoc?.name ?? "",
    sectionName: sectionDoc?.name ?? "",
    subjectName: subjectDoc?.name ?? "",
  };
}
