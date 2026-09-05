import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { resolveLinkedStudentClassScope } from "@/lib/exams/access";
import { getExamResultView, listMarkSummaries, listParentExams } from "@/lib/marks/service";
import { getResultsViewerMode, isResultsReadOnlyActor } from "@/lib/results/access";
import { Result } from "@/models/workspace";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function getResultsModuleContext(ctx: TenantContext) {
  const mode = getResultsViewerMode(ctx);
  return {
    mode,
    canManage: !isResultsReadOnlyActor(ctx),
  };
}

export async function listResultCards(ctx: TenantContext) {
  const mode = getResultsViewerMode(ctx);
  if (mode === "parent" || mode === "student") {
    return listParentExams(ctx);
  }
  const items = await listMarkSummaries(ctx, {});
  return { items };
}

export async function getResultReport(ctx: TenantContext, examId: string, studentId?: string) {
  return getExamResultView(ctx, examId, studentId);
}

export async function getResultReportById(ctx: TenantContext, resultId: string) {
  if (!mongoose.isValidObjectId(resultId)) throw new ApiError(400, "Invalid result.");
  const result = await Result.findOne({ _id: resultId, workspaceId: oid(ctx.workspaceId) })
    .select("examId studentId")
    .lean();
  if (!result) throw new ApiError(404, "Result not found.");
  const family = await resolveLinkedStudentClassScope(ctx);
  if (family && String(result.studentId) !== family.studentId) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  return getExamResultView(ctx, String(result.examId), String(result.studentId));
}
