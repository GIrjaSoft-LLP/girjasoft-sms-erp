import { HomeworkPanel } from "@/components/homework/HomeworkPanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function HomeworkPage() {
  return (
    <ModulePageGuard resourceKey="homework">
      <HomeworkPanel />
    </ModulePageGuard>
  );
}
