import { AdmissionNav } from "@/components/AdmissionNav";

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <p className="text-sm text-slate-500">Enquiries, applications, follow-ups and admission reports.</p>
      </div>
      <AdmissionNav />
      {children}
    </div>
  );
}
