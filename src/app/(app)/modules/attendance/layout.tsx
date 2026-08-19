import { AttendanceNav } from "@/components/AttendanceNav";

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-slate-500">Class-wise and subject-wise attendance for students.</p>
      </div>
      <AttendanceNav />
      {children}
    </div>
  );
}
