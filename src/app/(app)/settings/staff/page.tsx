import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function SettingsStaffPage() {
  return (
    <ModulePageGuard resourceKey="staff">
      <ModuleManager resourceKey="staff" />
    </ModulePageGuard>
  );
}
