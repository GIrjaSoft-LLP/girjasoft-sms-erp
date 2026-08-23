"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { PasswordDialog } from "@/components/PasswordDialog";
import { SidebarNavGroup } from "@/components/SidebarNavGroup";
import { TeacherContextDialog } from "@/components/TeacherContextDialog";
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
    linkedTeacherId?: string | null;
    teacherContextClassId?: string | null;
    teacherContextSectionId?: string | null;
    teacherContextSubjectId?: string | null;
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
  const [teacherContextOpen, setTeacherContextOpen] = useState(false);
  const [teacherContextLabels, setTeacherContextLabels] = useState<{
    className: string;
    sectionName: string;
    subjectName: string;
  } | null>(null);

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

  useEffect(() => {
    if (!me?.roleSlugs?.includes("teacher") || !me.linkedTeacherId) {
      setTeacherContextOpen(false);
      setTeacherContextLabels(null);
      return;
    }
    if (!me.teacherContextClassId || !me.teacherContextSectionId) {
      setTeacherContextOpen(true);
      setTeacherContextLabels(null);
      return;
    }
    setTeacherContextOpen(false);
    api<{ context?: { className: string; sectionName: string; subjectName?: string } }>("/api/teacher/dashboard")
      .then((data) => {
        if (data.context) {
          setTeacherContextLabels({
            className: data.context.className,
            sectionName: data.context.sectionName,
            subjectName: data.context.subjectName ?? "",
          });
        }
      })
      .catch(() => undefined);
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

  async function refreshMe(context?: {
    classId: string;
    sectionId: string;
    subjectId?: string | null;
    className?: string;
    sectionName?: string;
    subjectName?: string;
  }) {
    if (context && me) {
      setMe({
        ...me,
        teacherContextClassId: context.classId,
        teacherContextSectionId: context.sectionId,
        teacherContextSubjectId: context.subjectId ?? null,
      });
      if (context.className && context.sectionName) {
        setTeacherContextLabels({
          className: context.className,
          sectionName: context.sectionName,
          subjectName: context.subjectName ?? "",
        });
      }
      setTeacherContextOpen(false);
    }

    try {
      const data = await api<Me>("/api/auth/me");
      setMe(data.user);
      if (data.user.teacherContextClassId && data.user.teacherContextSectionId) {
        setTeacherContextOpen(false);
      }
    } catch {
      if (context) setTeacherContextOpen(false);
    }
    router.refresh();
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden gs-shell-bg">
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
          } gs-sidebar shrink-0 overflow-hidden transition-[width] duration-200`}
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
                    className={`block whitespace-nowrap px-2.5 py-1.5 gs-sidebar-link ${
                      item.href === "/settings"
                        ? pathname.startsWith("/settings")
                          ? "gs-sidebar-link-active"
                          : ""
                        : item.href === "/dashboard"
                          ? pathname === "/dashboard"
                            ? "gs-sidebar-link-active"
                            : ""
                          : pathname === item.href
                            ? "gs-sidebar-link-active"
                            : ""
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
          {teacherContextLabels ? (
            <div className="gs-banner-info border-b px-6 py-2 text-sm">
              Today&apos;s Class: {teacherContextLabels.className}-{teacherContextLabels.sectionName}
              {teacherContextLabels.subjectName ? ` · ${teacherContextLabels.subjectName}` : ""}
              <button type="button" className="ml-3 underline" style={{ color: "var(--accent)" }} onClick={() => setTeacherContextOpen(true)}>
                Change
              </button>
            </div>
          ) : null}
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
      {teacherContextOpen ? (
        <TeacherContextDialog onComplete={(context) => refreshMe(context)} />
      ) : null}
    </div>
  );
}
