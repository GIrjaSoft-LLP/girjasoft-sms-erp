export const PRINTABLE_DOCUMENTS: Record<
  string,
  { title: string; permission: string }
> = {
  payments: { title: "Fee Receipt / Invoice", permission: "payments.view" },
  fees: { title: "Fee Bill", permission: "fees.view" },
  payroll: { title: "Salary / Payroll Slip", permission: "payroll.view" },
  results: { title: "Result / Marksheet", permission: "results.view" },
  expenses: { title: "Expense Voucher", permission: "expenses.view" },
  marks: { title: "Marks Statement", permission: "marks.view" },
};

export function isPrintableDocument(key: string) {
  return key in PRINTABLE_DOCUMENTS;
}
