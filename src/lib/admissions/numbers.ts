import { AdmissionApplication, AdmissionEnquiry } from "@/models/admissions";
import { AcademicSession } from "@/models/workspace";
import { getAdmissionSettings } from "@/lib/admissions/settings";

function padSeq(value: number, size = 4) {
  return String(value).padStart(size, "0");
}

async function sessionLabel(workspaceId: string, academicSessionId?: string | null) {
  if (!academicSessionId) return new Date().getFullYear().toString();
  const session = await AcademicSession.findOne({ _id: academicSessionId, workspaceId }).select("name").lean();
  return session?.name?.replace(/\s+/g, "") ?? new Date().getFullYear().toString();
}

export async function nextSequenceNumber(
  workspaceId: string,
  model: typeof AdmissionEnquiry | typeof AdmissionApplication,
  field: "enquiryNumber" | "applicationNumber",
  prefix: string,
) {
  const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const latest = await model
    .find({ workspaceId, [field]: regex })
    .sort({ createdAt: -1 })
    .limit(1)
    .select(field)
    .lean();
  const last = latest[0]?.[field as keyof (typeof latest)[0]] as string | undefined;
  const seq = last ? Number(last.match(/(\d+)$/)?.[1] ?? 0) + 1 : 1;
  return padSeq(seq);
}

export async function generateEnquiryNumber(workspaceId: string, academicSessionId?: string | null) {
  const session = await sessionLabel(workspaceId, academicSessionId);
  const seq = await nextSequenceNumber(workspaceId, AdmissionEnquiry, "enquiryNumber", `ENQ/${session}/`);
  return `ENQ/${session}/${seq}`;
}

export async function generateApplicationNumber(workspaceId: string, academicSessionId?: string | null) {
  const settings = await getAdmissionSettings(workspaceId);
  const session = await sessionLabel(workspaceId, academicSessionId);
  const prefix = settings.applicationNumberFormat
    .replace("{session}", session)
    .replace("{seq}", "")
    .replace(/\/$/, "");
  const seq = await nextSequenceNumber(workspaceId, AdmissionApplication, "applicationNumber", `${prefix}/`);
  return `${prefix}/${seq}`;
}

export async function generateAdmissionNumber(workspaceId: string, academicSessionId?: string | null) {
  const settings = await getAdmissionSettings(workspaceId);
  const session = await sessionLabel(workspaceId, academicSessionId);
  const prefix = settings.admissionNumberFormat
    .replace("{session}", session)
    .replace("{seq}", "")
    .replace(/\/$/, "");
  const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const latest = await AdmissionApplication.find({
    workspaceId,
    admissionNumber: regex,
  })
    .sort({ createdAt: -1 })
    .limit(1)
    .select("admissionNumber")
    .lean();
  const last = latest[0]?.admissionNumber;
  const seq = last ? Number(last.match(/(\d+)$/)?.[1] ?? 0) + 1 : 1;
  return `${prefix}/${padSeq(seq)}`;
}

export function computeFeeTotals(fees: {
  registrationFee?: number;
  applicationFee?: number;
  admissionFee?: number;
  securityDeposit?: number;
  tuitionFee?: number;
  transportFee?: number;
  otherCharges?: number;
  discount?: number;
  tax?: number;
  paid?: number;
}) {
  const gross =
    Number(fees.registrationFee ?? 0) +
    Number(fees.applicationFee ?? 0) +
    Number(fees.admissionFee ?? 0) +
    Number(fees.securityDeposit ?? 0) +
    Number(fees.tuitionFee ?? 0) +
    Number(fees.transportFee ?? 0) +
    Number(fees.otherCharges ?? 0);
  const discount = Number(fees.discount ?? 0);
  const tax = Number(fees.tax ?? 0);
  const net = Math.max(0, gross - discount + tax);
  const paid = Number(fees.paid ?? 0);
  return { gross, discount, tax, net, paid, due: Math.max(0, net - paid) };
}
