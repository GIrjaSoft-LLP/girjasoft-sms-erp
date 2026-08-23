"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/config/branding";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ redirectTo: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, workspaceCode: workspaceCode || undefined }),
      });
      router.replace(result.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between gs-sidebar text-white p-10">
        <BrandMark />
        <div>
          <h1 className="text-4xl font-semibold">{APP_NAME}</h1>
          <p className="mt-3 text-blue-200 text-lg">{APP_TAGLINE}</p>
          <p className="mt-8 max-w-md text-blue-100">
            Multi-workspace school operations for admissions, academics, fees, examinations,
            people and campus services — isolated per school.
          </p>
        </div>
        <p className="text-sm text-blue-200">{COMPANY_NAME}</p>
      </div>
      <div className="grid place-items-center p-6 gs-shell-bg">
        <form onSubmit={onSubmit} className="gs-card w-full max-w-md p-8 space-y-4">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div>
            <h2 className="text-2xl font-semibold gs-heading">{APP_NAME}</h2>
            <p className="gs-muted">{APP_TAGLINE}</p>
          </div>
          <label className="block text-sm">
            Email / Username
            <input className="gs-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Password
            <input className="gs-input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="block text-sm">
            Workspace code (optional)
            <input className="gs-input mt-1" value={workspaceCode} onChange={(e) => setWorkspaceCode(e.target.value)} placeholder="GIRJA-SCHOOL-001" />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="gs-btn w-full py-3" disabled={busy}>
            {busy ? "Signing in…" : "Login"}
          </button>
          <Link href="/forgot-password" className="block text-sm text-[#4c7eff]">
            Forgot Password?
          </Link>
        </form>
      </div>
    </div>
  );
}
