"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";
import { api } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [message, setMessage] = useState("");
  const [serviceUnavailable, setServiceUnavailable] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setServiceUnavailable("");
    try {
      const data = await api<{ message: string; serviceUnavailable?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          workspaceCode: workspaceCode || undefined,
        }),
      });
      setMessage(data.message);
      if (data.serviceUnavailable) setServiceUnavailable(data.serviceUnavailable);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto grid place-items-center gs-shell-bg p-6">
      <form onSubmit={onSubmit} className="gs-card max-w-md w-full p-8 space-y-4">
        <BrandMark />
        <div>
          <h1 className="text-xl font-semibold gs-heading">Forgot Password</h1>
          <p className="text-sm gs-muted mt-1">{APP_NAME}</p>
        </div>
        <label className="block text-sm">
          Email / Username
          <input
            className="gs-input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          Workspace code
          <input
            className="gs-input mt-1"
            value={workspaceCode}
            onChange={(e) => setWorkspaceCode(e.target.value.toUpperCase())}
            placeholder="Required for school accounts"
          />
        </label>
        <button type="submit" className="gs-btn w-full py-2.5" disabled={busy}>
          {busy ? "Sending…" : "Send Reset Link"}
        </button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {serviceUnavailable ? <p className="text-sm text-amber-700">{serviceUnavailable}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Link className="text-sm" style={{ color: "var(--accent)" }} href="/login">
          Back to login
        </Link>
      </form>
    </div>
  );
}
