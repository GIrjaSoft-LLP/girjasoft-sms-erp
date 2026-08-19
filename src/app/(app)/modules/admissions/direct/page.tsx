import { AdmissionApplicationForm } from "@/components/admissions/AdmissionApplicationForm";

export default function DirectAdmissionPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Direct admission lets authorized staff create an application without a prior enquiry. Duplicate checks, documents, fees and student creation still apply.
      </p>
      <AdmissionApplicationForm direct />
    </div>
  );
}
