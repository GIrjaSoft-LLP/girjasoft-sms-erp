import { errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { PlatformSettings } from "@/models/platform";

const KEY = "general";

export async function GET() {
  try {
    await requirePlatformPerm("platform.settings.view");
    const doc = await PlatformSettings.findOne({ key: KEY }).lean();
    return json({ settings: doc?.value ?? {} });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformPerm("platform.settings.edit");
    const body = (await request.json()) as Record<string, unknown>;
    const doc = await PlatformSettings.findOneAndUpdate(
      { key: KEY },
      { key: KEY, value: body },
      { upsert: true, new: true },
    );
    return json({ settings: doc.value });
  } catch (error) {
    return errorResponse(error);
  }
}
