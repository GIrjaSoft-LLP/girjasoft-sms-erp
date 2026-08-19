import { StudentInfoNav } from "@/components/StudentInfoNav";

export default function StudentInfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Student Info</h1>
        <p className="text-sm text-slate-500">
          Central hub for students, parents/guardians, and academic records.
        </p>
      </div>
      <StudentInfoNav />
      {children}
    </div>
  );
}
