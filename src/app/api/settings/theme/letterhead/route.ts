import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requirePerm, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { brandFromWorkspace, normalizeLetterheadTheme } from "@/config/theme";
import { buildLetterheadDocx, letterheadFilename } from "@/lib/letterhead-docx";
import { Settings } from "@/models/workspace";
import { Workspace } from "@/models/platform";

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "settings.view");
    const url = new URL(request.url);
    const blank = url.searchParams.get("blank") === "1";
    const body = z
      .object({
        design: z.string().optional(),
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional(),
      })
      .parse(await request.json().catch(() => ({})));
    const settings = await Settings.findOne(scopedQuery(ctx.workspaceId)).lean();
    const workspace = await Workspace.findById(ctx.workspaceId).lean();
    const organization = (settings?.organization ?? {}) as Record<string, unknown>;
    const theme = normalizeLetterheadTheme({ ...(settings?.theme ?? {}), ...body });
    const brand = brandFromWorkspace(workspace as Record<string, unknown> | null, organization);
    const buffer = await buildLetterheadDocx(brand, theme, blank);
    const filename = letterheadFilename(brand.schoolName, blank);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    return errorResponse(new ApiError(400, "Could not generate the letterhead document."));
  }
}
