import mongoose from "mongoose";
import { ApiError } from "@/lib/api/guards";
import type { ClassTeacherScope, SubjectTeacherScope } from "@/lib/attendance/scope";
import {
  SchoolClass,
  Section,
  Subject,
  Teacher,
  TeacherClassAssignment,
  Timetable,
} from "@/models/workspace";

export type TeacherClassGroup = {
  classId: string;
  className: string;
  sections: Array<{ sectionId: string; name: string }>;
  subjects: Array<{ subjectId: string; name: string }>;
  teachers?: Array<{ teacherId: string; name: string; employeeId?: string }>;
};

function workspaceObjectId(workspaceId: string) {
  return new mongoose.Types.ObjectId(workspaceId);
}

export async function getAssignedClassIds(workspaceId: string, teacherId: string) {
  const rows = await TeacherClassAssignment.find({
    workspaceId: workspaceObjectId(workspaceId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    status: "ACTIVE",
  })
    .select("classId")
    .lean();
  return [...new Set(rows.map((row) => String(row.classId)))];
}

export async function expandClassIdsToScopes(
  workspaceId: string,
  classIds: string[],
): Promise<{ classTeacher: ClassTeacherScope[]; subjectTeacher: SubjectTeacherScope[] }> {
  if (!classIds.length) {
    return { classTeacher: [], subjectTeacher: [] };
  }

  const classObjectIds = classIds.map((id) => new mongoose.Types.ObjectId(id));
  const [classes, sections, subjects] = await Promise.all([
    SchoolClass.find({ workspaceId, _id: { $in: classObjectIds } }).select("name").lean(),
    Section.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
    Subject.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
  ]);

  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const classTeacher: ClassTeacherScope[] = sections.map((section) => ({
    kind: "CLASS",
    classId: String(section.classId),
    sectionId: String(section._id),
    className: classMap.get(String(section.classId)) ?? "",
    sectionName: section.name,
    label: `${classMap.get(String(section.classId)) ?? "Class"}-${section.name}`,
  }));

  const subjectsByClass = new Map<string, typeof subjects>();
  for (const subject of subjects) {
    const key = String(subject.classId);
    const bucket = subjectsByClass.get(key) ?? [];
    bucket.push(subject);
    subjectsByClass.set(key, bucket);
  }

  const subjectTeacher: SubjectTeacherScope[] = [];
  for (const section of sections) {
    const classId = String(section.classId);
    const classSubjects = subjectsByClass.get(classId) ?? [];
    for (const subject of classSubjects) {
      subjectTeacher.push({
        kind: "SUBJECT",
        classId,
        sectionId: String(section._id),
        subjectId: String(subject._id),
        className: classMap.get(classId) ?? "",
        sectionName: section.name,
        subjectName: subject.name,
        label: `${classMap.get(classId) ?? "Class"}-${section.name} · ${subject.name}`,
      });
    }
  }

  return { classTeacher, subjectTeacher };
}

export async function getAdminAssignmentScopes(workspaceId: string, teacherId: string) {
  const classIds = await getAssignedClassIds(workspaceId, teacherId);
  return expandClassIdsToScopes(workspaceId, classIds);
}

export async function getTeacherClassGroups(
  workspaceId: string,
  teacherId: string,
  options?: { includeTeachers?: boolean },
): Promise<TeacherClassGroup[]> {
  const classIds = await getAssignedClassIds(workspaceId, teacherId);
  if (!classIds.length) return [];

  const classObjectIds = classIds.map((id) => new mongoose.Types.ObjectId(id));
  const [classes, sections, subjects, assignmentRows] = await Promise.all([
    SchoolClass.find({ workspaceId, _id: { $in: classObjectIds } }).select("name").lean(),
    Section.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
    Subject.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
    options?.includeTeachers
      ? TeacherClassAssignment.find({ workspaceId, classId: { $in: classObjectIds }, status: "ACTIVE" })
          .select("teacherId classId")
          .lean()
      : [],
  ]);

  const teacherMap = new Map<string, { name: string; employeeId?: string }>();
  if (options?.includeTeachers && assignmentRows.length) {
    const teacherIds = [...new Set(assignmentRows.map((row) => String(row.teacherId)))];
    const teachers = await Teacher.find({ workspaceId, _id: { $in: teacherIds } })
      .select("name employeeId")
      .lean();
    for (const row of teachers) {
      teacherMap.set(String(row._id), { name: row.name, employeeId: row.employeeId });
    }
  }

  const teachersByClass = new Map<string, string[]>();
  for (const row of assignmentRows) {
    const key = String(row.classId);
    const bucket = teachersByClass.get(key) ?? [];
    bucket.push(String(row.teacherId));
    teachersByClass.set(key, [...new Set(bucket)]);
  }

  return classes
    .map((classDoc) => {
      const classId = String(classDoc._id);
      const group: TeacherClassGroup = {
        classId,
        className: classDoc.name,
        sections: sections
          .filter((row) => String(row.classId) === classId)
          .map((row) => ({ sectionId: String(row._id), name: row.name })),
        subjects: subjects
          .filter((row) => String(row.classId) === classId)
          .map((row) => ({ subjectId: String(row._id), name: row.name })),
      };

      if (options?.includeTeachers) {
        group.teachers = (teachersByClass.get(classId) ?? []).map((id) => ({
          teacherId: id,
          name: teacherMap.get(id)?.name ?? "",
          employeeId: teacherMap.get(id)?.employeeId,
        }));
      }

      return group;
    })
    .sort((a, b) => a.className.localeCompare(b.className));
}

export async function getTeacherAssignmentAdminView(workspaceId: string, teacherId: string) {
  const teacher = await Teacher.findOne({ _id: teacherId, workspaceId }).select("name employeeId email status").lean();
  if (!teacher) throw new ApiError(404, "Teacher not found.");

  const [assignedClassGroups, allClasses] = await Promise.all([
    getTeacherClassGroups(workspaceId, teacherId),
    SchoolClass.find({ workspaceId, status: { $ne: "INACTIVE" } }).sort({ name: 1 }).select("name").lean(),
  ]);

  return {
    teacher: {
      _id: String(teacher._id),
      name: teacher.name,
      employeeId: teacher.employeeId,
      email: teacher.email ?? "",
      status: teacher.status,
    },
    assignedClassIds: assignedClassGroups.map((row) => row.classId),
    assignedClasses: assignedClassGroups,
    allClasses: allClasses.map((row) => ({ _id: String(row._id), name: row.name })),
  };
}

export async function syncTeacherClassAssignments(workspaceId: string, teacherId: string, classIds: string[]) {
  const teacher = await Teacher.findOne({ _id: teacherId, workspaceId });
  if (!teacher) throw new ApiError(404, "Teacher not found.");

  const uniqueIds = [...new Set(classIds.map((id) => id.trim()).filter(Boolean))];
  for (const id of uniqueIds) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, "Invalid class selection.");
    }
  }

  const validClasses = uniqueIds.length
    ? await SchoolClass.find({
        workspaceId,
        _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id")
        .lean()
    : [];

  const validObjectIds = validClasses.map((row) => row._id);

  await TeacherClassAssignment.deleteMany({
    workspaceId: workspaceObjectId(workspaceId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    classId: { $nin: validObjectIds },
  });

  const existing = await TeacherClassAssignment.find({
    workspaceId: workspaceObjectId(workspaceId),
    teacherId: new mongoose.Types.ObjectId(teacherId),
    classId: { $in: validObjectIds },
  })
    .select("classId")
    .lean();
  const existingSet = new Set(existing.map((row) => String(row.classId)));

  const toCreate = validObjectIds.filter((id) => !existingSet.has(String(id)));
  if (toCreate.length) {
    await TeacherClassAssignment.insertMany(
      toCreate.map((classId) => ({
        workspaceId: workspaceObjectId(workspaceId),
        teacherId: new mongoose.Types.ObjectId(teacherId),
        classId,
        status: "ACTIVE",
      })),
      { ordered: false },
    ).catch((error: { code?: number }) => {
      if (error?.code !== 11000) throw error;
    });
  }

  return getTeacherAssignmentAdminView(workspaceId, teacherId);
}

export async function previewClassAssignmentDetails(workspaceId: string, classIds: string[]) {
  const validIds = classIds.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) return [] as TeacherClassGroup[];

  const classObjectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
  const [classes, sections, subjects] = await Promise.all([
    SchoolClass.find({ workspaceId, _id: { $in: classObjectIds } }).select("name").lean(),
    Section.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
    Subject.find({ workspaceId, classId: { $in: classObjectIds } }).select("name classId").lean(),
  ]);

  return classes
    .map((classDoc) => {
      const classId = String(classDoc._id);
      return {
        classId,
        className: classDoc.name,
        sections: sections
          .filter((row) => String(row.classId) === classId)
          .map((row) => ({ sectionId: String(row._id), name: row.name })),
        subjects: subjects
          .filter((row) => String(row.classId) === classId)
          .map((row) => ({ subjectId: String(row._id), name: row.name })),
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));
}

export async function backfillTeacherClassAssignmentsFromLegacy(workspaceId: string) {
  const wsObjectId = workspaceObjectId(workspaceId);
  const [sections, timetableRows] = await Promise.all([
    Section.find({ workspaceId, classTeacherId: { $ne: null } }).select("classId classTeacherId").lean(),
    Timetable.find({ workspaceId, teacherId: { $ne: null } }).select("classId teacherId").lean(),
  ]);

  const pairs = new Map<string, { teacherId: mongoose.Types.ObjectId; classId: mongoose.Types.ObjectId }>();
  for (const section of sections) {
    if (!section.classTeacherId || !section.classId) continue;
    const key = `${section.classTeacherId}:${section.classId}`;
    pairs.set(key, {
      teacherId: section.classTeacherId as mongoose.Types.ObjectId,
      classId: section.classId as mongoose.Types.ObjectId,
    });
  }
  for (const row of timetableRows) {
    if (!row.teacherId || !row.classId) continue;
    const key = `${row.teacherId}:${row.classId}`;
    pairs.set(key, {
      teacherId: row.teacherId as mongoose.Types.ObjectId,
      classId: row.classId as mongoose.Types.ObjectId,
    });
  }

  let created = 0;
  for (const pair of pairs.values()) {
    const exists = await TeacherClassAssignment.findOne({
      workspaceId: wsObjectId,
      teacherId: pair.teacherId,
      classId: pair.classId,
    }).lean();
    if (exists) continue;
    await TeacherClassAssignment.create({
      workspaceId: wsObjectId,
      teacherId: pair.teacherId,
      classId: pair.classId,
      status: "ACTIVE",
    });
    created += 1;
  }
  return { created, total: pairs.size };
}

export function canManageTeacherAssignments(permissions: string[]) {
  return permissions.includes("teachers.assign") || permissions.includes("teachers.edit");
}
