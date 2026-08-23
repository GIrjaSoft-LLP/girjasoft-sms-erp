import { ProfileNav } from "@/components/ProfileNav";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold gs-heading">Profile</h1>
        <p className="text-sm gs-muted">Manage your account, password and appearance.</p>
      </div>
      <ProfileNav />
      {children}
    </div>
  );
}
