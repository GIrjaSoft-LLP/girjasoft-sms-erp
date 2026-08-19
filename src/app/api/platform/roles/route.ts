import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { ensurePlatformSystemRoles } from "@/lib/platform-access";
import { PlatformRole } from "@/models/platform";

export async function GET() {
  try {
    await requirePlatformPerm("platform.roles.view");
    await ensurePlatformSystemRoles();
    const items = await PlatformRole.find().sort({ name: 1 }).lean();
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
