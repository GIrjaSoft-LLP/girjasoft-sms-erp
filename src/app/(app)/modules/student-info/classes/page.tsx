import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function StudentInfoClassesPage() {
  return (
    <ModulePageGuard resourceKey="classes">
      <ModuleManager resourceKey="classes" />
    </ModulePageGuard>
  );
}
