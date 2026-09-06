import { ApiError } from "@/lib/api/guards";
import { AdmissionApplication, AdmissionEnquiry } from "@/models/admissions";
import { AcademicSession, Student } from "@/models/workspace";
import { getAdmissionSettings } from "@/lib/admissions/settings";

function padSeq(value: number, size = 4) {
  return String(value).padStart(size, "0");
}

function prefixRegex(prefix: string) {
  return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

function trailingSeq(value?: string | null) {
  return Number(String(value ?? "").match(/(\d+)$/)?.[1] ?? 0);
}

async function maxTrailingSeq(
  workspaceId: string,
  model: { find: (query: Record<string, unknown>) => { select: (field: string) => { lean: () => Promise<Array<Record<string, unknown>>> } } },
  field: string,
  prefix: string,
) {
  const rows = await model.find({ workspaceId, [field]: prefixRegex(prefix) }).select(field).lean();
  return rows.reduce((max, row) => Math.max(max, trailingSeq(String(row[field] ?? ""))), 0);
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
  const max = await maxTrailingSeq(workspaceId, model, field, prefix);
  return padSeq(max + 1);
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
  const [applicationMax, studentMax] = await Promise.all([
    maxTrailingSeq(workspaceId, AdmissionApplication, "admissionNumber", `${prefix}/`),
    maxTrailingSeq(workspaceId, Student, "admissionNumber", `${prefix}/`),
  ]);
  return `${prefix}/${padSeq(Math.max(applicationMax, studentMax) + 1)}`;
}

export async function allocateAdmissionNumber(
  workspaceId: string,
  academicSessionId?: string | null,
  preferred?: string | null,
) {
  const reserved = preferred?.trim();
  if (reserved) {
    const taken = await Student.findOne({ workspaceId, admissionNumber: reserved }).select("_id").lean();
    if (!taken) return reserved;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const next = await generateAdmissionNumber(workspaceId, academicSessionId);
    const taken = await Student.findOne({ workspaceId, admissionNumber: next }).select("_id").lean();
    if (!taken) return next;
  }
  throw new ApiError(409, "Could not allocate a unique admission number.");
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
