import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function StudentInfoSectionsPage() {
  return (
    <ModulePageGuard resourceKey="sections">
      <ModuleManager resourceKey="sections" />
    </ModulePageGuard>
  );
}
