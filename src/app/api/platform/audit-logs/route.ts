import { errorResponse, json, requireSuperAdmin } from "@/lib/api/guards";
import { PlatformAuditLog } from "@/models/platform";

export async function GET() {
  try {
    await requireSuperAdmin();
    const items = await PlatformAuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
    return json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
