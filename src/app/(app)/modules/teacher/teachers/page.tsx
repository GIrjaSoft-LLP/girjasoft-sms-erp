import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function TeacherListPage() {
  return (
    <ModulePageGuard resourceKey="teachers">
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
        Teachers are managed from <strong>Settings → Staff</strong>. Set Staff Type to <strong>Teacher</strong> when creating staff. This list is read-only.
      </div>
      <ModuleManager resourceKey="teachers" readOnly allowCreate={false} viewPathPrefix="/modules/teacher/teachers" />
    </ModulePageGuard>
  );
}
