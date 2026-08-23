import { ModulePageGuard } from "@/components/ModulePageGuard";
import { TeacherAssignmentsManager } from "@/components/TeacherAssignmentsManager";

export default function TeacherAssignmentsSettingsPage() {
  return (
    <ModulePageGuard resourceKey="teachers">
      <TeacherAssignmentsManager />
    </ModulePageGuard>
  );
}
