import { TeacherNav } from "@/components/TeacherNav";

export default function TeacherModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Teacher</h1>
        <p className="text-sm text-slate-500">
          View teacher records, assignments, and academic activities. Teachers are created from Settings → Staff.
        </p>
      </div>
      <TeacherNav />
      {children}
    </div>
  );
}
