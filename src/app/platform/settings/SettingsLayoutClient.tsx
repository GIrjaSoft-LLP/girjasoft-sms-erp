"use client";

import { useEffect, useState } from "react";
import { PlatformSettingsNav } from "@/components/PlatformSettingsNav";
import { api } from "@/lib/client";

export function PlatformSettingsLayoutClient({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  useEffect(() => {
    api<{ user: { permissions?: string[] } }>("/api/auth/me")
      .then((data) => setPermissions(data.user.permissions ?? []))
      .catch(() => setPermissions([]));
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Settings</h1>
        <p className="text-sm text-slate-500">Platform administration, roles and users.</p>
      </div>
      <PlatformSettingsNav permissions={permissions} />
      {children}
    </div>
  );
}
