"use client";

import { DocumentLetterhead, type Letterhead } from "@/components/DocumentLetterhead";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK: "Bank Transfer",
  QR: "QR Code",
  OTHER: "Other",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function PaymentReceipt({
  item,
  letterhead,
}: {
  item: Record<string, unknown>;
  letterhead: Letterhead;
}) {
  const studentName = text(item.studentName);
  const className = text(item.className);
  const sectionName = text(item.sectionName);
  const classLabel = [className, sectionName].filter(Boolean).join(" - ");
  const method = text(item.method);
  const rows = [
    ["Student Name", studentName],
    ["Class", classLabel || className],
    ["Admission No.", text(item.admissionNumber)],
    ["Fee Head", text(item.feeHead)],
    ["Amount", item.amount != null && item.amount !== "" ? String(item.amount) : ""],
    ["Payment Method", METHOD_LABELS[method] ?? method],
    ["Receipt Number", text(item.receiptNumber)],
    ["Date", text(item.date)],
    ["Remarks", text(item.remarks)],
  ].filter(([, value]) => value);

  return (
    <article className="document-sheet result-certificate">
      <div className="result-certificate-inner">
        <DocumentLetterhead letterhead={letterhead} title="Fee Receipt" />
        <dl className="result-field-grid" style={{ marginTop: 8 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="result-field">
              <dt className="result-field-label">{label}</dt>
              <dd className="result-field-value">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="result-generated">This is a system-generated receipt.</p>
      </div>
    </article>
  );
}
