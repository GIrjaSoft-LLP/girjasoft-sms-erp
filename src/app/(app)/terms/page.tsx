import { COMPANY_NAME } from "@/config/branding";

export default function TermsPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <div className="gs-card p-6 space-y-3 text-sm text-slate-600">
        <p>
          GirjaSoft SMS ERP is provided to authorized workspaces of {COMPANY_NAME}. Users must
          protect their credentials, use the system only for school operations, and comply with
          applicable education and data-protection rules.
        </p>
        <p>
          Workspace administrators are responsible for user access, role assignment, and the
          accuracy of records entered in their tenant.
        </p>
      </div>
    </div>
  );
}
