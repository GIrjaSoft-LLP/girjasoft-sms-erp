import { ProfileNav } from "@/components/ProfileNav";

export default function PlatformProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold gs-heading">Profile</h1>
        <p className="text-sm gs-muted">Manage your platform account, password and appearance.</p>
      </div>
      <ProfileNav rootPath="/platform/profile" />
      {children}
    </div>
  );
}
