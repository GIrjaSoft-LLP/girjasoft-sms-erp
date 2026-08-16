"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { NavLink } from "@/config/nav";
import { api } from "@/lib/client";

export function SectionTabs({
  items,
  rootPath,
}: {
  items: NavLink[];
  rootPath: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [sessionRole, setSessionRole] = useState("");

  useEffect(() => {
    api<{ user: { permissions?: string[]; sessionRole?: string } }>("/api/auth/me")
      .then((data) => {
        setPermissions(data.user.permissions ?? []);
        setSessionRole(data.user.sessionRole ?? "");
      })
      .catch(() => setPermissions([]));
  }, []);

  const visible = useMemo(() => {
    if (sessionRole === "SUPER_ADMIN") return items;
    const perms = permissions ?? [];
    return items.filter((item) => perms.includes(item.permission));
  }, [items, permissions, sessionRole]);

  useEffect(() => {
    if (permissions === null) return;
    if (pathname !== rootPath) return;
    const exact = items.find((item) => item.exact && item.href === rootPath);
    const canRoot =
      sessionRole === "SUPER_ADMIN" || (exact ? permissions.includes(exact.permission) : false);
    if (canRoot) return;
    const fallback = visible.find((item) => item.href !== rootPath)?.href;
    if (fallback) router.replace(fallback);
  }, [items, pathname, permissions, rootPath, router, sessionRole, visible]);

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active ? "bg-[#4c7eff] text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
