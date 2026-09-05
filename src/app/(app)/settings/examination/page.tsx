import { GradeCriteriaEditor } from "@/components/marks/GradeCriteriaEditor";

export default function ExaminationSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold gs-heading">Examination</h2>
        <p className="text-sm gs-muted">Configure workspace-wide marks rating criteria.</p>
      </div>
      <GradeCriteriaEditor />
    </div>
  );
}
