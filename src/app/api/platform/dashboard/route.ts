import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { excludePortalAccounts } from "@/lib/parent-account";
import { workspaceSubscription } from "@/lib/workspace-validity";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";
import { Staff, Student, Teacher } from "@/models/workspace";

export async function GET() {
  try {
    await requirePlatformPerm("platform.workspaces.view");
    const [
      totalWorkspaces,
      activeWorkspaces,
      disabledWorkspaces,
      suspendedWorkspaces,
      archivedWorkspaces,
      totalUsers,
      totalStudents,
      totalTeachers,
      totalStaff,
      workspaces,
    ] = await Promise.all([
      Workspace.countDocuments(),
      Workspace.countDocuments({ status: "ACTIVE" }),
      Workspace.countDocuments({ status: "DISABLED" }),
      Workspace.countDocuments({ status: "SUSPENDED" }),
      Workspace.countDocuments({ status: "ARCHIVED" }),
      User.countDocuments(excludePortalAccounts()),
      Student.countDocuments(),
      Teacher.countDocuments(),
      Staff.countDocuments(),
      Workspace.find().sort({ lastActivityAt: -1 }).limit(25).lean(),
    ]);

    const overview = await Promise.all(
      workspaces.map(async (workspace) => {
        const [users, students, admin] = await Promise.all([
          User.countDocuments({ workspaceId: workspace._id, ...excludePortalAccounts() }),
          Student.countDocuments({ workspaceId: workspace._id }),
          workspace.adminUserId
            ? User.findById(workspace.adminUserId).select("name email")
            : null,
        ]);
        return {
          id: String(workspace._id),
          name: workspace.name,
          schoolName: workspace.schoolName,
          code: workspace.code,
          status: workspace.status,
          createdAt: workspace.createdAt,
          lastActivityAt: workspace.lastActivityAt,
          users,
          students,
          admin: admin?.name ?? "—",
          ...workspaceSubscription(workspace),
        };
      }),
    );

    return json({
      stats: {
        totalWorkspaces,
        activeWorkspaces,
        disabledWorkspaces,
        suspendedWorkspaces,
        archivedWorkspaces,
        totalUsers,
        totalStudents,
        totalTeachers,
        totalStaff,
      },
      workspaces: overview,
      alerts: overview.filter((row) => row.warning),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
