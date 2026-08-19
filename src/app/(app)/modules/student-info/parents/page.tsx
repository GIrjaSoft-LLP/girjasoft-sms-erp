import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function StudentInfoParentsPage() {
  return (
    <ModulePageGuard resourceKey="parents">
      <ModuleManager resourceKey="parents" />
    </ModulePageGuard>
  );
}
