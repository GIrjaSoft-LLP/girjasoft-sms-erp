import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { excludePortalAccounts } from "@/lib/parent-account";

export async function GET() {
  try {
    await requirePlatformPerm("platform.workspaceUsers.view");
    const workspaces = await Workspace.find().select("name code schoolName").lean();
    const users = await User.find(excludePortalAccounts())
      .select("name email username workspaceId status lastLoginAt")
      .lean();
    return json({
      items: users
        .filter((user) => user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase())
        .map((user) => ({
          ...user,
          workspace: workspaces.find((w) => String(w._id) === String(user.workspaceId)),
        })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
