import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function StudentInfoSubjectsPage() {
  return (
    <ModulePageGuard resourceKey="subjects">
      <ModuleManager resourceKey="subjects" />
    </ModulePageGuard>
  );
}
