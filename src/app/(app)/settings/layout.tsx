import { SettingsNav } from "@/components/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">Workspace administration, users, staff and roles.</p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
