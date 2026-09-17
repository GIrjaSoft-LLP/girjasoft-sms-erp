export function formatInr(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

export type FeePayInfo = {
  fee: {
    _id: string;
    studentName: string;
    className: string;
    sectionName: string;
    feeHead: string;
    description: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
  };
  payment: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
    upiId: string;
    qrCodeUrl: string;
    currency: string;
  };
  review: {
    _id: string;
    status: string;
    amount: number;
    date: string;
    method: string;
    transactionRef: string;
    submittedAt?: string;
    rejectionReason: string;
  } | null;
};

export function classLabel(fee: Pick<FeePayInfo["fee"], "className" | "sectionName">) {
  return [fee.className, fee.sectionName].filter(Boolean).join(" - ");
}
