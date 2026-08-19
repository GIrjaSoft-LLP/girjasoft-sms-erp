"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { PasswordDialog } from "@/components/PasswordDialog";
import { PlatformExpiryBanner } from "@/components/PlatformExpiryBanner";
import { PLATFORM_NAV } from "@/config/nav";
import { api } from "@/lib/client";

type Me = {
  user: {
    name: string;
    email: string;
    sessionRole?: string;
    permissions?: string[];
    photo?: string;
  };
};

type Alert = {
  id: string;
  schoolName: string;
  code: string;
  expired: boolean;
  daysRemaining: number | null;
  validityTill: string;
};

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Me["user"] | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api<Me>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!user?.permissions?.includes("platform.workspaces.view")) return;
    api<{ alerts?: Alert[] }>("/api/platform/dashboard")
      .then((data) => setAlerts(data.alerts ?? []))
      .catch(() => setAlerts([]));
  }, [user]);

  const nav = useMemo(() => {
    const perms = user?.permissions ?? [];
    const all = user?.sessionRole === "SUPER_ADMIN";
    return PLATFORM_NAV.filter((item) => all || perms.includes(item.permission));
  }, [user]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f3f6fb]">
      <AppHeader
        variant="platform"
        user={user}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onChangePassword={() => setPasswordOpen(true)}
        onSignOut={() => void logout()}
      />
      {!dismissed && alerts.length ? <PlatformExpiryBanner alerts={alerts} onDismiss={() => setDismissed(true)} /> : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "w-56" : "w-0"
          } shrink-0 overflow-hidden bg-[#0b1b3a] text-white transition-[width] duration-200`}
        >
          <div className="flex h-full w-56 flex-col">
            <nav className="gs-sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block whitespace-nowrap rounded-lg px-2.5 py-1.5 ${
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                      ? "bg-[#4c7eff]"
                      : "hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <main className="gs-main-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="p-6">{children}</div>
        </main>
      </div>
      <AppFooter showLogo={false} />
      {passwordOpen ? (
        <PasswordDialog
          title="Change password"
          requireCurrent
          onClose={() => setPasswordOpen(false)}
          onSave={async () => undefined}
          onSaveWithCurrent={async (currentPassword, newPassword) => {
            await api("/api/auth/change-password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, newPassword }),
            });
          }}
        />
      ) : null}
    </div>
  );
}
