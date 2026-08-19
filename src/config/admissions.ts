export const ENQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP_REQUIRED",
  "APPLICATION_STARTED",
  "APPLICATION_SUBMITTED",
  "CONVERTED",
  "LOST",
  "CLOSED",
] as const;

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_VERIFIED",
  "FEE_PENDING",
  "APPROVAL_PENDING",
  "APPROVED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
] as const;

export const DOCUMENT_STATUSES = ["PENDING", "UPLOADED", "UNDER_REVIEW", "VERIFIED", "REJECTED"] as const;

export const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "RESCHEDULED", "CANCELLED"] as const;

export const REFUND_STATUSES = ["NOT_APPLICABLE", "PENDING", "APPROVED", "PROCESSED", "REJECTED"] as const;

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "NET_BANKING", "CHEQUE", "ONLINE"] as const;

export const DEFAULT_ADMISSION_DOCUMENTS = [
  { key: "birth_certificate", name: "Birth Certificate", mandatory: true },
  { key: "aadhaar", name: "Aadhaar Card", mandatory: true },
  { key: "passport_photo", name: "Passport Photo", mandatory: true },
  { key: "parent_id", name: "Parent ID", mandatory: false },
  { key: "address_proof", name: "Address Proof", mandatory: false },
  { key: "transfer_certificate", name: "Transfer Certificate", mandatory: false },
  { key: "previous_marksheet", name: "Previous Marksheet", mandatory: false },
  { key: "migration_certificate", name: "Migration Certificate", mandatory: false },
  { key: "medical_certificate", name: "Medical Certificate", mandatory: false },
  { key: "other", name: "Other Documents", mandatory: false },
] as const;

export const DEFAULT_ADMISSION_SETTINGS = {
  admissionNumberFormat: "ADM/{session}/{seq}",
  applicationNumberFormat: "APP/{session}/{seq}",
  rollNumberPrefix: "ROLL",
  autoCreateStudent: true,
  autoCreateParentAccount: true,
  requireDocumentVerification: true,
  requirePaymentBeforeConfirm: true,
  workflowStages: [
    "SUBMITTED",
    "DOCUMENTS_VERIFIED",
    "APPROVED",
    "PAYMENT_PENDING",
    "CONFIRMED",
  ],
  feeHeads: {
    registrationFee: 500,
    applicationFee: 1000,
    admissionFee: 5000,
    securityDeposit: 2000,
    tuitionFee: 0,
    transportFee: 0,
    otherCharges: 0,
  },
  documents: DEFAULT_ADMISSION_DOCUMENTS.map((doc) => ({ ...doc })),
  enquirySources: ["Walk-in", "Website", "Phone", "Referral", "Social Media", "Campaign", "Other"],
};

export type AdmissionDocumentConfig = {
  key: string;
  name: string;
  mandatory: boolean;
};

export type AdmissionSettings = Omit<typeof DEFAULT_ADMISSION_SETTINGS, "documents"> & {
  documents: AdmissionDocumentConfig[];
};

import type { NavLink } from "@/config/nav";

export const ADMISSION_NAV: NavLink[] = [
  { href: "/modules/admissions", label: "Dashboard", permission: "admissions.view", exact: true },
  { href: "/modules/admissions/enquiries", label: "Enquiries", permission: "admissions.view" },
  { href: "/modules/admissions/applications", label: "Applications", permission: "admissions.view" },
  { href: "/modules/admissions/direct", label: "Direct Admission", permission: "admissions.create" },
  { href: "/modules/admissions/follow-ups", label: "Follow-ups", permission: "admissions.view" },
  { href: "/modules/admissions/reports", label: "Reports", permission: "admissions.reports" },
  { href: "/settings/admission", label: "Settings", permission: "admissions.view" },
];
