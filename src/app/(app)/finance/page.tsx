"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FINANCE_NAV } from "@/config/nav";
import { api } from "@/lib/client";

export default function FinanceIndexPage() {
  const router = useRouter();

  useEffect(() => {
    api<{ user: { permissions?: string[]; sessionRole?: string } }>("/api/auth/me")
      .then((data) => {
        const perms = data.user.permissions ?? [];
        const allowAll = data.user.sessionRole === "SUPER_ADMIN";
        const first = FINANCE_NAV.find((item) => allowAll || perms.includes(item.permission));
        router.replace(first?.href ?? "/dashboard");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  return <p className="text-slate-500">Opening Finance…</p>;
}
