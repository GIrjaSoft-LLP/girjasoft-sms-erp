"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_SETTINGS_NAV } from "@/config/nav";

export function PlatformSettingsNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = PLATFORM_SETTINGS_NAV.filter((item) => permissions.includes(item.permission));
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "gs-tab-active" : "gs-tab"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
