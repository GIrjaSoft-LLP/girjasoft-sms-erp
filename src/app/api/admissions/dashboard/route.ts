import { errorResponse, json, scopedQuery } from "@/lib/api/guards";
import { requireAdmissionContext } from "@/lib/admissions/guard";
import { AdmissionApplication, AdmissionEnquiry, AdmissionFollowUp } from "@/models/admissions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const query = scopedQuery(ctx.workspaceId);
    const day = today();
    const [
      totalEnquiries,
      newEnquiriesToday,
      followUpsPending,
      applicationsReceived,
      admissionsConfirmed,
      admissionsPending,
      upcomingFollowUps,
      recentEnquiries,
      recentApplications,
      pendingApplications,
      recentConfirmed,
      pendingPayments,
      documentsPending,
    ] = await Promise.all([
      AdmissionEnquiry.countDocuments(query),
      AdmissionEnquiry.countDocuments({ ...query, enquiryDate: day }),
      AdmissionFollowUp.countDocuments({ ...query, status: "PENDING" }),
      AdmissionApplication.countDocuments({ ...query, status: { $ne: "DRAFT" } }),
      AdmissionApplication.countDocuments({ ...query, status: "CONFIRMED" }),
      AdmissionApplication.countDocuments({
        ...query,
        status: { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "FEE_PENDING", "APPROVAL_PENDING", "PAYMENT_PENDING"] },
      }),
      AdmissionFollowUp.countDocuments({ ...query, status: "PENDING", followUpDate: { $lte: day } }),
      AdmissionEnquiry.find(query).sort({ createdAt: -1 }).limit(5).lean(),
      AdmissionApplication.find(query).sort({ createdAt: -1 }).limit(5).lean(),
      AdmissionApplication.find({
        ...query,
        status: { $in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_PENDING", "APPROVAL_PENDING"] },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AdmissionApplication.find({ ...query, status: "CONFIRMED" }).sort({ updatedAt: -1 }).limit(5).lean(),
      AdmissionApplication.find({ ...query, "fees.due": { $gt: 0 }, status: { $ne: "CANCELLED" } })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
      AdmissionApplication.find({
        ...query,
        documents: { $elemMatch: { mandatory: true, status: { $ne: "VERIFIED" } } },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const conversionRate =
      applicationsReceived > 0 ? Math.round((admissionsConfirmed / applicationsReceived) * 100) : 0;

    return json({
      stats: {
        totalEnquiries,
        newEnquiriesToday,
        followUpsPending,
        applicationsReceived,
        admissionsConfirmed,
        admissionsPending,
        conversionRate,
        upcomingFollowUps,
      },
      recentEnquiries,
      recentApplications,
      pendingApplications,
      recentConfirmed,
      pendingPayments,
      documentsPending,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
