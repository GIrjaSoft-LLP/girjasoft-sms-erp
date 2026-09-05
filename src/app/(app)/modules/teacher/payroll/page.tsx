import { ModulePageGuard } from "@/components/ModulePageGuard";
import { TeacherSalarySlipsPanel } from "@/components/payroll/TeacherSalarySlipsPanel";

export default function TeacherPayrollPage() {
  return (
    <ModulePageGuard resourceKey="payroll">
      <TeacherSalarySlipsPanel embedded />
    </ModulePageGuard>
  );
}
