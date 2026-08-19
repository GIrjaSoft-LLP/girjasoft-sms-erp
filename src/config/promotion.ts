export const PROMOTION_STATUSES = [
  "ENROLLED",
  "PENDING",
  "PROMOTED",
  "NOT_PROMOTED",
  "TRANSFERRED",
  "GRADUATED",
  "ARCHIVED",
] as const;

export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const STUDENT_MASTER_STATUSES = ["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED", "ARCHIVED"] as const;

export type StudentMasterStatus = (typeof STUDENT_MASTER_STATUSES)[number];

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  ENROLLED: "Enrolled",
  PENDING: "Pending Promotion",
  PROMOTED: "Promoted",
  NOT_PROMOTED: "Not Promoted",
  TRANSFERRED: "Transferred",
  GRADUATED: "Graduated",
  ARCHIVED: "Archived",
};

export const STUDENT_EDITABLE_FIELDS = [
  "name",
  "firstName",
  "middleName",
  "lastName",
  "gender",
  "dateOfBirth",
  "bloodGroup",
  "aadhaar",
  "nationality",
  "religion",
  "category",
  "motherTongue",
  "phone",
  "email",
  "address",
  "emergencyContact",
  "emergencyPhone",
  "status",
] as const;
