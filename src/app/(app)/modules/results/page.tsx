import { ResultsPanel } from "@/components/results/ResultsPanel";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function ResultsPage() {
  return (
    <ModulePageGuard resourceKey="results">
      <ResultsPanel />
    </ModulePageGuard>
  );
}
