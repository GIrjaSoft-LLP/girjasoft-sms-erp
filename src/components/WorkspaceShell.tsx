"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { PasswordDialog } from "@/components/PasswordDialog";
import { SidebarNavGroup } from "@/components/SidebarNavGroup";
import { WORKSPACE_NAV } from "@/config/nav";
import { navHrefAllowed } from "@/lib/workspace-modules";
import { api } from "@/lib/client";

type Me = {
  user: {
    name: string;
    email: string;
    accountType: string;
    sessionRole: string;
    permissions?: string[];
    roleSlugs?: string[];
    linkedStudentIds?: string[];
    linkedStudentId?: string | null;
  };
};

type Dash = {
  workspace: { name: string; schoolName: string; logo?: string; code: string; enabledModules?: string[] };
  impersonating: boolean;
};

type LinkedChild = { _id: string; name: string; className?: string; sectionName?: string };

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me["user"] | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChild[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    api<Me>("/api/auth/me")
      .then((data) => {
        setMe(data.user);
        if (data.user.sessionRole === "SUPER_ADMIN" && data.user.accountType === "PLATFORM") {
          return Promise.all([
            api<Dash>("/api/dashboard"),
            api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
          ])
            .then(([dashboard, modules]) => {
              setDash(dashboard);
              setEnabledModuleIds(modules.enabledModuleIds);
            })
            .catch(() => {
              router.replace("/platform/dashboard");
            });
        }
        return Promise.all([
          api<Dash>("/api/dashboard"),
          api<{ enabledModuleIds: string[] }>("/api/workspace/modules"),
        ]).then(([dashboard, modules]) => {
          setDash(dashboard);
          setEnabledModuleIds(modules.enabledModuleIds);
        });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!me?.roleSlugs?.includes("parent") || !(me.linkedStudentIds?.length ?? 0)) {
      setLinkedChildren([]);
      return;
    }
    api<{ items: LinkedChild[] }>("/api/students")
      .then((data) => setLinkedChildren(data.items))
      .catch(() => setLinkedChildren([]));
  }, [me]);

  const workspaceLike = useMemo(() => ({ enabledModules: enabledModuleIds }), [enabledModuleIds]);

  const nav = useMemo(() => {
    const perms = me?.permissions ?? [];
    const allow = me?.sessionRole === "SUPER_ADMIN" || Boolean(dash?.impersonating);
    return WORKSPACE_NAV.flatMap((item) => {
      if (item.href === "/dashboard") {
        return navHrefAllowed(item.href, workspaceLike, perms, allow) ? [item] : [];
      }
      if (item.children?.length) {
        const children = (allow ? item.children : item.children.filter((child) => perms.includes(child.permission))).filter(
          (child) => navHrefAllowed(child.href, workspaceLike, perms, allow),
        );
        if (!children.length) return [];
        return [{ ...item, children }];
      }
      if (allow) {
        return navHrefAllowed(item.href, workspaceLike, perms, true) ? [item] : [];
      }
      const visible = item.anyOf
        ? item.anyOf.some((permission) => perms.includes(permission))
        : perms.includes(item.permission);
      if (!visible) return [];
      return navHrefAllowed(item.href, workspaceLike, perms, false) ? [item] : [];
    });
  }, [dash?.impersonating, me, workspaceLike]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function exitWorkspace() {
    await api("/api/platform/workspaces/exit", { method: "POST" });
    router.replace("/platform/dashboard");
  }

  async function switchChild(studentId: string) {
    await api("/api/auth/active-child", {
      method: "POST",
      body: JSON.stringify({ studentId }),
    });
    router.refresh();
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f3f6fb]">
      {dash?.impersonating ? (
        <div className="flex shrink-0 justify-between bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0b1b3a]">
          <span>
            Viewing Workspace: {dash.workspace.schoolName} ({dash.workspace.code})
          </span>
          <button onClick={exitWorkspace} className="underline">
            Exit Workspace
          </button>
        </div>
      ) : null}
      <AppHeader
        user={me}
        workspace={dash?.workspace}
        enabledModuleIds={enabledModuleIds}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onChangePassword={() => setPasswordOpen(true)}
        onSignOut={() => void logout()}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "w-56" : "w-0"
          } shrink-0 overflow-hidden bg-[#0b1b3a] text-white transition-[width] duration-200`}
        >
          <div className="flex h-full w-56 flex-col">
            <nav className="gs-sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2 text-sm">
              {nav.map((item) =>
                item.children?.length ? (
                  <SidebarNavGroup key={item.href} item={item} links={item.children} />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block whitespace-nowrap rounded-lg px-2.5 py-1.5 ${
                      item.href === "/settings"
                        ? pathname.startsWith("/settings")
                          ? "bg-[#4c7eff]"
                          : "hover:bg-white/10"
                        : item.href === "/dashboard"
                          ? pathname === "/dashboard"
                            ? "bg-[#4c7eff]"
                            : "hover:bg-white/10"
                          : pathname === item.href
                            ? "bg-[#4c7eff]"
                            : "hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            {me?.roleSlugs?.includes("parent") && (me.linkedStudentIds?.length ?? 0) > 1 ? (
              <div className="shrink-0 border-t border-white/10 px-4 py-3 text-xs">
                <label className="block">
                  Active child
                  <select
                    className="mt-1 w-full rounded bg-white/10 p-2"
                    value={me.linkedStudentId ?? ""}
                    onChange={(e) => switchChild(e.target.value)}
                  >
                    {me.linkedStudentIds?.map((id) => {
                      const child = linkedChildren.find((row) => row._id === id);
                      const label = child
                        ? `${child.name}${child.className ? ` · ${child.className}` : ""}${child.sectionName ? `-${child.sectionName}` : ""}`
                        : id;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            ) : null}
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
