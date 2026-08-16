"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PasswordDialog } from "@/components/PasswordDialog";
import { APP_NAME, COMPANY_NAME } from "@/config/branding";
import { PLATFORM_NAV } from "@/config/nav";
import { api } from "@/lib/client";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#f3f6fb]">
      <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden bg-[#0b1b3a] text-white">
        <div className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0">
              <BrandMark variant="mark" size={40} />
            </div>
            <p className="min-w-0 text-sm font-semibold leading-snug text-white">{APP_NAME}</p>
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-blue-200">Platform Administration</p>
        </div>
        <nav className="gs-sidebar-scroll min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 text-sm">
          {PLATFORM_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 ${
                pathname === item.href || (item.href !== "/platform/dashboard" && pathname.startsWith(item.href))
                  ? "bg-[#4c7eff]"
                  : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-4 text-xs text-blue-200">
          <div>{COMPANY_NAME}</div>
          <button onClick={() => setPasswordOpen(true)} className="mt-2 block underline">
            Change password
          </button>
          <button onClick={logout} className="mt-2 underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="gs-main-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="p-6">{children}</div>
      </main>
      {passwordOpen ? (
        <PasswordDialog
          title="Change Super Admin password"
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
