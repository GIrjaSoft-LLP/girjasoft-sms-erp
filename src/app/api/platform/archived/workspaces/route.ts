import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { archivedWorkspaceQuery } from "@/lib/platform/workspace-archive";
import { excludePortalAccounts } from "@/lib/parent-account";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    await requirePlatformPerm("platform.workspaces.view");
    const workspaces = await Workspace.find(archivedWorkspaceQuery()).sort({ archivedAt: -1, createdAt: -1 }).lean();
    const items = await Promise.all(
      workspaces.map(async (workspace) => {
        const [users, admin] = await Promise.all([
          User.countDocuments({ workspaceId: workspace._id }),
          workspace.adminUserId
            ? User.findOne({ _id: workspace.adminUserId, workspaceId: workspace._id }).select("name email")
            : User.findOne({ workspaceId: workspace._id, ...excludePortalAccounts() }).select("name email"),
        ]);
        return {
          id: String(workspace._id),
          name: workspace.name,
          schoolName: workspace.schoolName,
          code: workspace.code,
          website: workspace.website ?? "",
          email: workspace.email,
          status: workspace.status,
          users,
          admin: admin ? { name: admin.name, email: admin.email } : null,
          archivedAt: workspace.archivedAt ?? workspace.updatedAt,
          archivedByEmail: workspace.archivedByEmail ?? "",
        };
      }),
    );
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
