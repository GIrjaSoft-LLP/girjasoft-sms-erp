"use client";

import { DocumentLetterhead, type Letterhead } from "@/components/DocumentLetterhead";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return "";
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function SalarySlip({
  item,
  letterhead,
}: {
  item: Record<string, unknown>;
  letterhead: Letterhead;
}) {
  const status = text(item.status);
  const rows = [
    ["Staff Name", text(item.staffName)],
    ["Employee Code", text(item.employeeId)],
    ["Month", text(item.month)],
    ["Basic", money(item.basic)],
    ["Allowances", money(item.allowances)],
    ["Deductions", money(item.deductions)],
    ["Net Pay", money(item.netPay)],
    ["Status", status === "PAID" ? "Paid" : status === "DRAFT" ? "Draft" : status],
  ].filter(([, value]) => value);

  return (
    <article className="document-sheet result-certificate">
      <div className="result-certificate-inner">
        <DocumentLetterhead letterhead={letterhead} title="Salary Slip" />
        <dl className="result-field-grid" style={{ marginTop: 8 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="result-field">
              <dt className="result-field-label">{label}</dt>
              <dd className="result-field-value">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="result-generated">This is a system-generated salary slip.</p>
      </div>
    </article>
  );
}
