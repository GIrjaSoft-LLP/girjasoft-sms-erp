import {
  errorResponse,
  json,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { Attendance, FeePayment, Result, Student } from "@/models/workspace";
import { AuditLog } from "@/models/workspace";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "reports.view");
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "summary";
    const query = scopedQuery(ctx.workspaceId);

    if (type === "audit") {
      const items = await AuditLog.find(query).sort({ createdAt: -1 }).limit(200).lean();
      return json({ type, items });
    }
    if (type === "students") {
      const items = await Student.find(query).sort({ name: 1 }).lean();
      return json({ type, items });
    }
    if (type === "attendance") {
      const items = await Attendance.find(query).sort({ date: -1 }).limit(500).lean();
      return json({ type, items });
    }
    if (type === "fees") {
      const items = await FeePayment.find(query).sort({ date: -1 }).limit(500).lean();
      return json({ type, items });
    }
    if (type === "results") {
      const items = await Result.find(query).sort({ createdAt: -1 }).limit(500).lean();
      return json({ type, items });
    }

    const [students, attendance, payments, results] = await Promise.all([
      Student.countDocuments(query),
      Attendance.countDocuments(query),
      FeePayment.countDocuments(query),
      Result.countDocuments(query),
    ]);
    return json({ type: "summary", stats: { students, attendance, payments, results } });
  } catch (error) {
    return errorResponse(error);
  }
}
