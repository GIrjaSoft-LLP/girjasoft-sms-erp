import mongoose from "mongoose";
import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext } from "@/lib/api/guards";
import {
  buildTeacherClassSummaryFromAssignments,
  getTeacherAssignmentOptions,
  getTodayTimetableSuggestions,
  hydrateTeacherContextLabels,
  loadTeacherContextFromUser,
} from "@/lib/teacher-context";
import { isTeacherLike } from "@/lib/rbac";
import { Attendance, Homework, Teacher } from "@/models/workspace";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    const isTeacherPortal = isTeacherLike(ctx.session.roleSlugs) && !ctx.impersonating;

    if (isTeacherPortal && ctx.session.linkedTeacherId) {
      const teacherId = ctx.session.linkedTeacherId;
      const [{ assignments }, todaySchedule] = await Promise.all([
        getTeacherAssignmentOptions(ctx.workspaceId, teacherId),
        getTodayTimetableSuggestions(ctx.workspaceId, teacherId),
      ]);
      const myClasses = buildTeacherClassSummaryFromAssignments(assignments);
      const context = ctx.session.teacherContextClassId
        ? await hydrateTeacherContextLabels(ctx.workspaceId, {
            classId: String(ctx.session.teacherContextClassId),
            sectionId: String(ctx.session.teacherContextSectionId ?? ""),
            subjectId: ctx.session.teacherContextSubjectId,
          })
        : null;

      const today = new Date().toISOString().slice(0, 10);
      const pendingAttendance =
        ctx.session.teacherContextSectionId &&
        (await Attendance.countDocuments({
          workspaceId: ctx.workspaceId,
          sectionId: ctx.session.teacherContextSectionId,
          date: today,
          attendanceType: "CLASS",
        })) === 0
          ? 1
          : 0;

      const assignedClassIds = [...new Set(assignments.map((item) => item.classId))];
      const pendingHomework =
        assignedClassIds.length > 0
          ? await Homework.countDocuments({
              workspaceId: ctx.workspaceId,
              classId: { $in: assignedClassIds.map((id) => new mongoose.Types.ObjectId(id)) },
            })
          : 0;

      const stored = await loadTeacherContextFromUser(ctx.session.sub);

      return json({
        role: "teacher",
        teacherName: ctx.session.name,
        context,
        assignments,
        myClasses,
        todaySchedule,
        stats: {
          todayClasses: todaySchedule.length || assignments.length,
          pendingAttendance,
          pendingHomework,
        },
        previousContext: stored,
      });
    }

    const teachers = await Teacher.find({ workspaceId: ctx.workspaceId })
      .sort({ name: 1 })
      .select("name employeeId email department status")
      .lean();

    return json({
      role: "admin",
      stats: {
        totalTeachers: teachers.length,
        activeTeachers: teachers.filter((row) => row.status === "ACTIVE").length,
      },
      teachers: teachers.map((row) => ({
        _id: String(row._id),
        name: row.name,
        employeeId: row.employeeId,
        email: row.email,
        department: row.department,
        status: row.status,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
