import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function SettingsStaffPage() {
  return (
    <ModulePageGuard resourceKey="staff">
      <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-slate-700">
        To add a <strong>Teacher</strong>, create staff here with <strong>Staff Type = Teacher</strong>. Portal login and the Teacher ERP module are created automatically.
      </div>
      <ModuleManager resourceKey="staff" />
    </ModulePageGuard>
  );
}
