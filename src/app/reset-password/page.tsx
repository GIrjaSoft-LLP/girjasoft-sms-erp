"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";
import { api } from "@/lib/client";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const workspace = params.get("workspace") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token || !workspace) {
      setError("Invalid or expired reset link.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, workspaceCode: workspace }),
      });
      setMessage(data.message);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !workspace) {
    return (
      <div className="gs-card max-w-md w-full p-8 space-y-4">
        <BrandMark />
        <p className="text-sm text-red-600">Invalid or expired reset link.</p>
        <Link href="/login" className="text-sm" style={{ color: "var(--accent)" }}>
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="gs-card max-w-md w-full p-8 space-y-4">
      <BrandMark />
      <div>
        <h1 className="text-xl font-semibold gs-heading">Set New Password</h1>
        <p className="text-sm gs-muted mt-1">{APP_NAME}</p>
      </div>
      <label className="block text-sm">
        New password
        <input
          type="password"
          className="gs-input mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
        />
      </label>
      <label className="block text-sm">
        Confirm password
        <input
          type="password"
          className="gs-input mt-1"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={10}
        />
      </label>
      <button type="submit" className="gs-btn w-full py-2.5" disabled={busy}>
        {busy ? "Updating…" : "Update Password"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto grid place-items-center gs-shell-bg p-6">
      <Suspense fallback={<div className="gs-card p-8">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
