import { errorResponse, json, scopedQuery } from "@/lib/api/guards";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication, AdmissionEnquiry, AdmissionFollowUp } from "@/models/admissions";

export async function GET(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.reports");
    const url = new URL(request.url);
    const report = url.searchParams.get("report") ?? "summary";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const query = scopedQuery(ctx.workspaceId);
    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) (dateFilter.createdAt as Record<string, Date>).$gte = new Date(from);
      if (to) (dateFilter.createdAt as Record<string, Date>).$lte = new Date(`${to}T23:59:59`);
    }

    if (report === "enquiries") {
      const items = await AdmissionEnquiry.find({ ...query, ...dateFilter }).sort({ enquiryDate: -1 }).lean();
      return json({ report, items, total: items.length });
    }

    if (report === "applications") {
      const items = await AdmissionApplication.find({ ...query, ...dateFilter }).sort({ applicationDate: -1 }).lean();
      return json({ report, items, total: items.length });
    }

    if (report === "confirmed") {
      const items = await AdmissionApplication.find({ ...query, status: "CONFIRMED", ...dateFilter }).lean();
      return json({ report, items, total: items.length });
    }

    if (report === "pending") {
      const items = await AdmissionApplication.find({
        ...query,
        status: { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "APPROVAL_PENDING", "PAYMENT_PENDING"] },
      }).lean();
      return json({ report, items, total: items.length });
    }

    if (report === "follow-ups") {
      const items = await AdmissionFollowUp.find({ ...query, ...dateFilter }).sort({ followUpDate: 1 }).lean();
      return json({ report, items, total: items.length });
    }

    if (report === "conversion") {
      const [enquiries, applications, confirmed] = await Promise.all([
        AdmissionEnquiry.countDocuments({ ...query, ...dateFilter }),
        AdmissionApplication.countDocuments({ ...query, status: { $ne: "DRAFT" }, ...dateFilter }),
        AdmissionApplication.countDocuments({ ...query, status: "CONFIRMED", ...dateFilter }),
      ]);
      return json({
        report,
        enquiries,
        applications,
        confirmed,
        conversionRate: applications > 0 ? Math.round((confirmed / applications) * 100) : 0,
      });
    }

    const [enquiries, applications, confirmed, pending, followUps] = await Promise.all([
      AdmissionEnquiry.countDocuments(query),
      AdmissionApplication.countDocuments({ ...query, status: { $ne: "DRAFT" } }),
      AdmissionApplication.countDocuments({ ...query, status: "CONFIRMED" }),
      AdmissionApplication.countDocuments({
        ...query,
        status: { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "PAYMENT_PENDING"] },
      }),
      AdmissionFollowUp.countDocuments({ ...query, status: "PENDING" }),
    ]);

    return json({
      report: "summary",
      enquiries,
      applications,
      confirmed,
      pending,
      followUps,
      conversionRate: applications > 0 ? Math.round((confirmed / applications) * 100) : 0,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
