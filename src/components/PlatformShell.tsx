"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { PasswordDialog } from "@/components/PasswordDialog";
import { PlatformExpiryBanner } from "@/components/PlatformExpiryBanner";
import { SidebarNavGroup } from "@/components/SidebarNavGroup";
import { PLATFORM_NAV } from "@/config/nav";
import { api } from "@/lib/client";
import { useResponsiveSidebar } from "@/lib/use-responsive-sidebar";

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
  const { setSidebarOpen, toggleSidebar, collapsedDesktop, mobileOpen } = useResponsiveSidebar();
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
    return PLATFORM_NAV.flatMap((item) => {
      if (item.children?.length) {
        const children = item.children.filter((child) => all || perms.includes(child.permission));
        if (!children.length) return [];
        return [{ ...item, children }];
      }
      if (all || perms.includes(item.permission)) return [item];
      return [];
    });
  }, [user]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden gs-shell-bg">
      <AppHeader
        variant="platform"
        user={user}
        onToggleSidebar={toggleSidebar}
        onChangePassword={() => setPasswordOpen(true)}
        onSignOut={() => void logout()}
      />
      {!dismissed && alerts.length ? <PlatformExpiryBanner alerts={alerts} onDismiss={() => setDismissed(true)} /> : null}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {mobileOpen ? (
          <button
            type="button"
            className="gs-sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <aside
          className={`gs-app-sidebar gs-sidebar ${collapsedDesktop ? "is-collapsed" : ""} ${
            mobileOpen ? "is-mobile-open" : ""
          }`}
        >
          <div className="flex h-full w-56 flex-col">
            <nav className="gs-sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2 text-sm">
              {nav.map((item) =>
                item.children?.length ? (
                  <SidebarNavGroup
                    key={item.href}
                    item={item}
                    links={item.children}
                    onNavigate={() => {
                      if (mobileOpen) setSidebarOpen(false);
                    }}
                  />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (mobileOpen) setSidebarOpen(false);
                    }}
                    className={`block whitespace-nowrap px-2.5 py-1.5 gs-sidebar-link ${
                      (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))
                        ? "gs-sidebar-link-active"
                        : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
        </aside>
        <main className="gs-main-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="p-6">{children}</div>
        </main>
      </div>
      <AppFooter />
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
