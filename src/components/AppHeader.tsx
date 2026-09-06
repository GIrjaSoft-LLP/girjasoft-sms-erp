"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";
import { SETTINGS_NAV } from "@/config/nav";
import { api } from "@/lib/client";

type User = {
  name: string;
  email: string;
  permissions?: string[];
  sessionRole?: string;
  photo?: string;
};

type Workspace = {
  schoolName: string;
  logo?: string;
  code: string;
};

function IconDashboard() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function HeaderIconTip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0b1b3a] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader({
  user,
  workspace,
  enabledModuleIds = [],
  variant = "workspace",
  onToggleSidebar,
  onChangePassword,
  onSignOut,
}: {
  user: User | null;
  workspace?: Workspace | null;
  enabledModuleIds?: string[];
  variant?: "workspace" | "platform";
  onToggleSidebar: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const isPlatform = variant === "platform";
  const perms = user?.permissions ?? [];
  const allowAll = user?.sessionRole === "SUPER_ADMIN" && !isPlatform;
  const can = (permission: string) => allowAll || perms.includes(permission);
  const commsEnabled = allowAll || enabledModuleIds.includes("comms-center");
  const settingsItems = isPlatform ? [] : SETTINGS_NAV.filter((item) => can(item.permission));
  const platformSettings = isPlatform && (user?.sessionRole === "SUPER_ADMIN" || perms.includes("platform.settings.view"));
  const dashboardHref = isPlatform ? "/platform/dashboard" : "/dashboard";
  const dashboardActive = pathname === dashboardHref || pathname?.startsWith(`${dashboardHref}/`);
  const [menu, setMenu] = useState<"user" | "settings" | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [helpUnread, setHelpUnread] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhotoFailed(false);
  }, [user?.photo]);

  useEffect(() => {
    if (isPlatform || !can("notices.view") || !commsEnabled) return;
    api<{ count: number }>("/api/notices/unread")
      .then((data) => setUnread(data.count ?? 0))
      .catch(() => setUnread(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, isPlatform]);

  useEffect(() => {
    if (!user || isPlatform) return;
    api<{ count: number }>("/api/help/unread")
      .then((data) => setHelpUnread(data.count ?? 0))
      .catch(() => setHelpUnread(0));
  }, [user, isPlatform]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="relative z-40 shrink-0 border-b border-slate-200 bg-white">
      <div ref={root} className="flex h-14 items-center gap-3 px-4">
        <button
          type="button"
          className="shrink-0 rounded-lg p-2 text-[#0b1b3a] hover:bg-slate-100"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {isPlatform ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-8 w-8 shrink-0 md:h-9 md:w-9">
              <BrandMark variant="mark" size={36} />
            </div>
            <div className="hidden min-w-0 md:block">
              <div className="truncate text-sm font-semibold leading-tight text-[#0b1b3a]">{APP_NAME}</div>
              <div className="truncate text-xs text-slate-500">Platform Administration</div>
            </div>
          </div>
        ) : workspace ? (
          <div className="flex min-w-0 items-center gap-3">
            {workspace.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspace.logo}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md object-cover bg-slate-100 md:h-9 md:w-9"
              />
            ) : (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#0b1b3a] text-[10px] font-semibold text-white md:h-9 md:w-9">
                GS
              </div>
            )}
            <div className="hidden min-w-0 md:block">
              <div className="truncate text-sm font-semibold leading-tight text-[#0b1b3a]">
                {workspace.schoolName}
              </div>
              <div className="truncate text-xs text-slate-500">{workspace.code}</div>
            </div>
          </div>
        ) : null}
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-sm text-[#0b1b3a]">
          {isPlatform || can("profile.view") ? (
            <Link
              href={dashboardHref}
              aria-label="Dashboard"
              className={`group relative grid h-9 w-9 shrink-0 place-items-center rounded-lg lg:inline-flex lg:h-auto lg:w-auto lg:px-3 lg:py-2 lg:font-medium ${
                dashboardActive ? "bg-[#4c7eff] text-white" : "hover:bg-slate-100"
              }`}
            >
              <span className="lg:hidden">
                <IconDashboard />
              </span>
              <span className="hidden whitespace-nowrap lg:inline">Dashboard</span>
              <span className="lg:hidden">
                <HeaderIconTip label="Dashboard" />
              </span>
            </Link>
          ) : null}
          {isPlatform ? (
            <Link
              href="/platform/tickets"
              aria-label="Tickets"
              className={`group relative grid h-9 w-9 place-items-center rounded-lg ${
                pathname === "/platform/tickets" || pathname?.startsWith("/platform/tickets/")
                  ? "bg-[#4c7eff] text-white"
                  : "hover:bg-slate-100"
              }`}
            >
              <IconBell />
              <HeaderIconTip label="Tickets" />
            </Link>
          ) : null}
          {can("reports.view") ? (
            <Link
              href="/reports"
              aria-label="Reports"
              className={`group relative grid h-9 w-9 place-items-center rounded-lg ${
                pathname === "/reports" || pathname?.startsWith("/reports/")
                  ? "bg-[#4c7eff] text-white"
                  : "hover:bg-slate-100"
              }`}
            >
              <IconDoc />
              <HeaderIconTip label="Reports" />
            </Link>
          ) : null}
          {can("notices.view") && commsEnabled ? (
            <Link
              href="/modules/notices"
              aria-label="Notices"
              className={`group relative grid h-9 w-9 place-items-center rounded-lg ${
                pathname === "/modules/notices" || pathname?.startsWith("/modules/notices/")
                  ? "bg-[#4c7eff] text-white"
                  : "hover:bg-slate-100"
              }`}
            >
              <IconBell />
              {unread > 0 ? (
                <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
              <HeaderIconTip label="Notices" />
            </Link>
          ) : null}
          {platformSettings ? (
            <Link
              href="/platform/settings"
              aria-label="Settings"
              className={`group relative grid h-9 w-9 place-items-center rounded-lg ${
                pathname?.startsWith("/platform/settings") ? "bg-[#4c7eff] text-white" : "hover:bg-slate-100"
              }`}
            >
              <IconGear />
              <HeaderIconTip label="Settings" />
            </Link>
          ) : null}
          {settingsItems.length ? (
            <div className="relative">
              <button
                type="button"
                className={`group relative grid h-9 w-9 place-items-center rounded-lg ${
                  pathname?.startsWith("/settings") ? "bg-[#4c7eff] text-white" : "hover:bg-slate-100"
                }`}
                onClick={() => setMenu(menu === "settings" ? null : "settings")}
                aria-label="Settings"
              >
                <IconGear />
                <HeaderIconTip label="Settings" />
              </button>
              {menu === "settings" ? (
                <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {settingsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => setMenu(null)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {user ? (
            <div className="relative">
              <button
                type="button"
                className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-[#4c7eff] text-xs font-semibold text-white hover:brightness-105"
                onClick={() => setMenu(menu === "user" ? null : "user")}
                aria-label="Account menu"
              >
                {user.photo && !photoFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photo} alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
                ) : (
                  initials(user.name) || "U"
                )}
              </button>
              {menu === "user" ? (
                <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="truncate text-sm font-semibold text-[#0b1b3a]">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  {isPlatform ? (
                    <>
                      <Link
                        href="/platform/profile"
                        className="block px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => setMenu(null)}
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/platform/profile/design"
                        className="block px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => setMenu(null)}
                      >
                        Design
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/profile"
                        className="block px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => setMenu(null)}
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/profile/design"
                        className="block px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => setMenu(null)}
                      >
                        Design
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setMenu(null);
                      onChangePassword();
                    }}
                  >
                    Change Password
                  </button>
                  {!isPlatform ? (
                    <Link
                      href="/help"
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => setMenu(null)}
                    >
                      <span>Help</span>
                      {helpUnread > 0 ? (
                        <span className="grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
                          {helpUnread > 99 ? "99+" : helpUnread}
                        </span>
                      ) : null}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                    onClick={() => {
                      setMenu(null);
                      onSignOut();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
