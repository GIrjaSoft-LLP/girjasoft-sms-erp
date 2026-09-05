import { ExamsPanel } from "@/components/exams/ExamsPanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function ExamsPage() {
  return (
    <ModulePageGuard resourceKey="exams">
      <ExamsPanel />
    </ModulePageGuard>
  );
}
