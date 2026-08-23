import { z } from "zod";
import { errorResponse, json, requireSession, requireWorkspaceContext } from "@/lib/api/guards";
import { isPlatformActor } from "@/lib/session";
import {
  DEFAULT_DESIGN_PREFERENCES,
  INSTITUTION_THEME_RECOMMENDATIONS,
  UI_MODE_IDS,
  UI_THEME_IDS,
  type DesignPreferences,
  type UiThemeId,
  normalizeDesignPreferences,
} from "@/config/ui-theme";
import { designPreferencesFromDb, mergeDesignPreferences } from "@/lib/design-preferences";
import { connectMongo } from "@/lib/mongodb";
import { User } from "@/models/identity";
import { PlatformAdmin } from "@/models/platform";
import { Settings } from "@/models/workspace";

const patchSchema = z.object({
  theme: z.enum(UI_THEME_IDS).optional(),
  mode: z.enum(UI_MODE_IDS).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  customized: z.boolean().optional(),
});

async function readWorkspaceRecommendedTheme(workspaceId: string): Promise<UiThemeId | null> {
  const settings = await Settings.findOne({ workspaceId }).select("uiDesign organization").lean();
  const explicit = settings?.uiDesign?.recommendedTheme;
  if (explicit && UI_THEME_IDS.includes(explicit)) return explicit as UiThemeId;
  const orgType = String(settings?.organization?.institutionType ?? "").toLowerCase().replace(/\s+/g, "_");
  return INSTITUTION_THEME_RECOMMENDATIONS[orgType] ?? null;
}

export async function GET() {
  try {
    await connectMongo();
    const session = await requireSession();

    if (isPlatformActor(session)) {
      const admin = await PlatformAdmin.findById(session.sub).select("designPreferences").lean();
      const preferences = mergeDesignPreferences(designPreferencesFromDb(admin?.designPreferences));
      return json({ preferences, recommendedTheme: null });
    }

    const ctx = await requireWorkspaceContext();
    const user = await User.findById(ctx.session.sub).select("designPreferences").lean();
    const recommendedTheme = await readWorkspaceRecommendedTheme(ctx.workspaceId);
    const preferences = mergeDesignPreferences(designPreferencesFromDb(user?.designPreferences), recommendedTheme);
    return json({ preferences, recommendedTheme });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await connectMongo();
    const session = await requireSession();
    const body = patchSchema.parse(await request.json());

    if (isPlatformActor(session)) {
      const admin = await PlatformAdmin.findById(session.sub);
      if (!admin) return json({ error: "User not found." }, 404);
      const current = designPreferencesFromDb(admin.designPreferences) ?? DEFAULT_DESIGN_PREFERENCES;
      const next: DesignPreferences = normalizeDesignPreferences({ ...current, ...body, customized: body.customized ?? true });
      admin.designPreferences = next;
      await admin.save();
      return json({ preferences: next });
    }

    const ctx = await requireWorkspaceContext();
    const user = await User.findById(ctx.session.sub);
    if (!user) return json({ error: "User not found." }, 404);
    const current = designPreferencesFromDb(user.designPreferences) ?? DEFAULT_DESIGN_PREFERENCES;
    const next: DesignPreferences = normalizeDesignPreferences({ ...current, ...body, customized: body.customized ?? true });
    user.designPreferences = next;
    await user.save();
    return json({ preferences: next });
  } catch (error) {
    return errorResponse(error);
  }
}
