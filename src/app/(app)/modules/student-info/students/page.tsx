import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function StudentInfoStudentsPage() {
  return (
    <ModulePageGuard resourceKey="students">
      <ModuleManager resourceKey="students" viewPathPrefix="/modules/student-info/students" />
    </ModulePageGuard>
  );
}
