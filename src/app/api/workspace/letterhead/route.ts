import { errorResponse, json, requirePerm, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { APP_NAME, COMPANY_NAME } from "@/config/branding";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";

export async function GET() {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "profile.view");
    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const organization = (settings?.organization ?? {}) as { logo?: string };
    const finance = (settings?.finance ?? {}) as { currency?: string; receiptPrefix?: string };
    return json({
      letterhead: {
        appName: APP_NAME,
        companyName: COMPANY_NAME,
        schoolName: workspace?.schoolName ?? workspace?.name ?? APP_NAME,
        logo: workspace?.logo || organization.logo || "",
        address: workspace?.address ?? "",
        phone: workspace?.phone ?? "",
        email: workspace?.email ?? "",
        website: workspace?.website ?? "",
        code: workspace?.code ?? "",
        currency: finance.currency ?? "INR",
        receiptPrefix: finance.receiptPrefix ?? "GS",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
