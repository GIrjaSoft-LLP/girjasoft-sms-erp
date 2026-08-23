"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile", label: "My Profile", exact: true },
  { href: "/profile/password", label: "Change Password" },
  { href: "/profile/design", label: "Design" },
];

export function ProfileNav({ rootPath = "/profile" }: { rootPath?: string }) {
  const pathname = usePathname();
  const tabs =
    rootPath === "/platform/profile"
      ? [
          { href: "/platform/profile", label: "My Profile", exact: true },
          { href: "/platform/profile/password", label: "Change Password" },
          { href: "/platform/profile/design", label: "Design" },
        ]
      : TABS;

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "gs-tab-active" : "gs-tab"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
