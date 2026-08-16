import {
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import {
  Attendance,
  Exam,
  Notice,
  Result,
  SchoolClass,
  Section,
  Staff,
  Student,
  StudentFee,
  Teacher,
} from "@/models/workspace";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";
import { staffUserQuery } from "@/lib/parent-account";
import { getViewWorkspaceId, isPlatformSuperAdmin } from "@/lib/session";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "profile.view");
    const workspaceId = ctx.workspaceId;
    const workspace = await Workspace.findById(workspaceId).lean();
    const query = scopedQuery(workspaceId);
    const userQuery = await staffUserQuery(workspaceId, query);
    const today = new Date().toISOString().slice(0, 10);
    const latestAttendance = await Attendance.findOne(query).sort({ date: -1 }).select("date").lean();
    const attendanceDate = latestAttendance?.date || today;
    const [
      students,
      teachers,
      staff,
      classes,
      sections,
      users,
      pendingFees,
      exams,
      results,
      notices,
      todayAttendance,
    ] = await Promise.all([
      Student.countDocuments(query),
      Teacher.countDocuments(query),
      Staff.countDocuments(query),
      SchoolClass.countDocuments(query),
      Section.countDocuments(query),
      User.countDocuments(userQuery),
      StudentFee.countDocuments({ ...query, status: { $ne: "PAID" } }),
      Exam.countDocuments(query),
      Result.countDocuments(query),
      Notice.countDocuments(query),
      Attendance.countDocuments({
        ...query,
        date: attendanceDate,
      }),
    ]);

    return json({
      workspace: {
        id: String(workspace?._id),
        name: workspace?.name,
        schoolName: workspace?.schoolName,
        logo: workspace?.logo,
        code: workspace?.code,
        status: workspace?.status,
      },
      impersonating: ctx.impersonating,
      stats: {
        students,
        teachers,
        staff,
        classes,
        sections,
        users,
        pendingFees,
        exams,
        results,
        notices,
        todayAttendance,
        attendanceDate,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function viewingWorkspace() {
  const viewId = await getViewWorkspaceId();
  return viewId;
}

export { isPlatformSuperAdmin };
