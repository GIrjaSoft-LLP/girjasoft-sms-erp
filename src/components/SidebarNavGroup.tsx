"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem, NavLink } from "@/config/nav";

function childActive(pathname: string, item: NavLink) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNavGroup({
  item,
  links,
}: {
  item: NavItem;
  links: NavLink[];
}) {
  const pathname = usePathname();
  const hasActiveChild = links.some((child) => childActive(pathname, child));
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  if (!links.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left whitespace-nowrap ${
          hasActiveChild ? "bg-white/10" : "hover:bg-white/10"
        }`}
        aria-expanded={open}
      >
        <span>{item.label}</span>
        <span className="text-xs text-blue-200">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="mt-0.5 ml-1.5 space-y-0.5 border-l border-white/10 pl-1.5">
          {links.map((child) => {
            const active = childActive(pathname, child);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`block whitespace-nowrap px-2.5 py-1.5 gs-sidebar-link ${
                  active ? "gs-sidebar-link-active" : ""
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
