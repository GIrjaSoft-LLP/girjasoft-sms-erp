import { FinanceNav } from "@/components/FinanceNav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-sm text-slate-500">Fees, payments, expenses and payroll.</p>
      </div>
      <FinanceNav />
      {children}
    </div>
  );
}
