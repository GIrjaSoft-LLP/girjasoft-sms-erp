import { MarksPanel } from "@/components/marks/MarksPanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function MarksPage() {
  return (
    <ModulePageGuard resourceKey="marks">
      <MarksPanel />
    </ModulePageGuard>
  );
}
