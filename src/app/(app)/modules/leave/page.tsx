import { LeavePanel } from "@/components/leave/LeavePanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function LeavePage() {
  return (
    <ModulePageGuard resourceKey="leave">
      <LeavePanel />
    </ModulePageGuard>
  );
}
