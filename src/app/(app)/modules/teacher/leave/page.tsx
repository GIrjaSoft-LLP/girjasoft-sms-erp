import { LeavePanel } from "@/components/leave/LeavePanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function TeacherLeavePage() {
  return (
    <ModulePageGuard resourceKey="leave">
      <LeavePanel embedded />
    </ModulePageGuard>
  );
}
