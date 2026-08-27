import mongoose from "mongoose";
import {
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { isParentLike, isTeacherLike } from "@/lib/rbac";
import { resolveTeacherAssignmentScope } from "@/lib/teacher-scope";
import {
  Attendance,
  Notice,
  Parent,
  SchoolClass,
  Section,
  Student,
  StudentFee,
} from "@/models/workspace";

async function hydrateStudents(
  workspaceId: string,
  students: Array<{ _id: unknown; name: string; admissionNumber: string; classId?: unknown; sectionId?: unknown; status?: string }>,
) {
  const classIds = [...new Set(students.map((s) => String(s.classId ?? "")).filter(Boolean))];
  const sectionIds = [...new Set(students.map((s) => String(s.sectionId ?? "")).filter(Boolean))];
  const [classes, sections] = await Promise.all([
    classIds.length ? SchoolClass.find({ workspaceId, _id: { $in: classIds } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ workspaceId, _id: { $in: sectionIds } }).select("name").lean() : [],
  ]);
  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  return students.map((student) => ({
    _id: String(student._id),
    name: student.name,
    admissionNumber: student.admissionNumber,
    className: classMap.get(String(student.classId ?? "")) ?? "",
    sectionName: sectionMap.get(String(student.sectionId ?? "")) ?? "",
    status: student.status ?? "ACTIVE",
  }));
}

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");
    const workspaceId = ctx.workspaceId;
    const query = scopedQuery(workspaceId);
    const today = new Date().toISOString().slice(0, 10);

    if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
      const linkedIds = (ctx.session.linkedStudentIds ?? []).filter(Boolean);
      const students = linkedIds.length
        ? await Student.find({ ...query, _id: { $in: linkedIds } })
            .select("name admissionNumber classId sectionId status")
            .sort({ name: 1 })
            .lean()
        : [];
      const children = await hydrateStudents(workspaceId, students);

      const [todayAttendance, totalDays, presentDays, pendingFees, pendingHomework, recentNotices] =
        await Promise.all([
          Attendance.countDocuments({
            ...query,
            studentId: { $in: linkedIds },
            date: today,
            status: { $in: ["PRESENT", "LATE"] },
          }),
          Attendance.countDocuments({ ...query, studentId: { $in: linkedIds } }),
          Attendance.countDocuments({
            ...query,
            studentId: { $in: linkedIds },
            status: { $in: ["PRESENT", "LATE"] },
          }),
          StudentFee.countDocuments({ ...query, studentId: { $in: linkedIds }, status: { $ne: "PAID" } }),
          Promise.resolve(0),
          Notice.countDocuments(query),
        ]);

      const attendancePercentage =
        totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : undefined;

      return json({
        role: "parent",
        stats: {
          totalStudents: children.length,
          totalParents: 0,
          activeStudents: children.filter((child) => child.status === "ACTIVE").length,
          childrenCount: children.length,
          todayAttendance: todayAttendance > 0 ? "Present" : linkedIds.length ? "Not marked" : "—",
          attendancePercentage,
          pendingFees,
          pendingHomework,
          recentNotices,
        },
        children,
        recentStudents: [],
      });
    }

    if (isTeacherLike(ctx.session.roleSlugs) && !ctx.impersonating && ctx.session.linkedTeacherId) {
      const teacherScope = await resolveTeacherAssignmentScope(ctx);
      const sectionIds = [...teacherScope.sectionIds];
      const studentQuery =
        sectionIds.length > 0
          ? {
              ...query,
              sectionId: { $in: sectionIds.map((id) => new mongoose.Types.ObjectId(id)) },
            }
          : { ...query, _id: { $in: [] } };

      const [totalStudents, activeStudents, recentRows, recentNotices] = await Promise.all([
        Student.countDocuments(studentQuery),
        Student.countDocuments({ ...studentQuery, status: "ACTIVE" }),
        Student.find(studentQuery).select("name admissionNumber classId sectionId status").sort({ updatedAt: -1 }).limit(8).lean(),
        Notice.countDocuments(query),
      ]);
      const recentStudents = await hydrateStudents(workspaceId, recentRows);

      return json({
        role: "teacher",
        stats: {
          totalStudents,
          activeStudents,
          recentNotices,
        },
        recentStudents,
      });
    }

    const [totalStudents, activeStudents, totalParents, recentRows, recentNotices] = await Promise.all([
      Student.countDocuments(query),
      Student.countDocuments({ ...query, status: "ACTIVE" }),
      Parent.countDocuments(query),
      Student.find(query).select("name admissionNumber classId sectionId status").sort({ updatedAt: -1 }).limit(8).lean(),
      Notice.countDocuments(query),
    ]);

    const recentStudents = await hydrateStudents(workspaceId, recentRows);

    return json({
      role: "admin",
      stats: {
        totalStudents,
        activeStudents,
        totalParents,
        recentNotices,
      },
      recentStudents,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
