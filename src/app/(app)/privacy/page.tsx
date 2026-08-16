import { COMPANY_NAME } from "@/config/branding";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <div className="gs-card p-6 space-y-3 text-sm text-slate-600">
        <p>
          {COMPANY_NAME} processes school workspace data solely to operate GirjaSoft SMS ERP for
          authorized institutions. Personal information is stored per workspace and is not shared
          across tenants.
        </p>
        <p>
          Access is limited to authenticated users according to assigned roles and permissions.
          Contact your workspace administrator for data access or correction requests.
        </p>
      </div>
    </div>
  );
}
