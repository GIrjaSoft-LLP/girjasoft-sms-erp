import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { archivedWorkspaceQuery } from "@/lib/platform/workspace-archive";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    await requirePlatformPerm("platform.workspaceUsers.view");
    const workspaces = await Workspace.find(archivedWorkspaceQuery())
      .select("name code schoolName website archivedAt archivedByEmail")
      .lean();
    const workspaceIds = workspaces.map((workspace) => workspace._id);
    const users = workspaceIds.length
      ? await User.find({ workspaceId: { $in: workspaceIds } })
          .select("name email phone username workspaceId status archivedAt roleIds")
          .populate("roleIds", "name slug")
          .sort({ archivedAt: -1, name: 1 })
          .lean()
      : [];

    return json({
      items: users
        .filter((user) => user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase())
        .map((user) => {
          const workspace = workspaces.find((row) => String(row._id) === String(user.workspaceId));
          const roles = Array.isArray(user.roleIds)
            ? user.roleIds
                .map((role: { name?: string } | string) =>
                  role && typeof role === "object" && "name" in role ? String(role.name ?? "") : "",
                )
                .filter(Boolean)
            : [];
          return {
            id: String(user._id),
            name: user.name,
            email: user.email,
            phone: user.phone ?? "",
            username: user.username,
            status: "ARCHIVED",
            archivedAt: user.archivedAt ?? workspace?.archivedAt ?? null,
            roles,
            workspace: workspace
              ? {
                  schoolName: workspace.schoolName,
                  name: workspace.name,
                  code: workspace.code,
                  website: workspace.website ?? "",
                }
              : null,
          };
        }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
