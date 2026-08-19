"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDisplayDate, workspaceSubscription } from "@/lib/workspace-validity";
import { api } from "@/lib/client";

export default function EditWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    schoolName: "",
    validityTill: "",
    status: "ACTIVE",
  });
  const [meta, setMeta] = useState({ code: "", schoolName: "" });
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ item: { schoolName: string; code: string; validityTill?: string; status: string } }>(`/api/platform/workspaces/${params.id}`),
      api<{ user: { permissions?: string[] } }>("/api/auth/me"),
    ])
      .then(([data, me]) => {
        const till = data.item.validityTill ? new Date(data.item.validityTill).toISOString().slice(0, 10) : "";
        setForm({ schoolName: data.item.schoolName, validityTill: till, status: data.item.status });
        setMeta({ code: data.item.code, schoolName: data.item.schoolName });
        setCanEdit((me.user.permissions ?? []).includes("platform.workspaces.edit"));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  const subscription = useMemo(
    () => workspaceSubscription({ status: form.status, validityTill: form.validityTill || null }),
    [form.status, form.validityTill],
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api(`/api/platform/workspaces/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Workspace updated.");
      router.push("/platform/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">Edit Workspace</h1>
        <p className="text-sm text-slate-500">{meta.code}</p>
        <Link href={`/platform/workspaces/${params.id}/modules`} className="text-sm text-[#4c7eff]">
          Manage Modules
        </Link>
      </div>
      {subscription.warning ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${subscription.expired ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <p className="font-semibold">{subscription.expired ? "Subscription Expired" : "Subscription Expiry Warning"}</p>
          <p className="mt-1">
            {subscription.expired
              ? `${meta.schoolName} subscription expired on ${formatDisplayDate(form.validityTill)}. Renew the subscription to restore active access.`
              : `${meta.schoolName} subscription expires in ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"}. Please renew before ${formatDisplayDate(form.validityTill)}.`}
          </p>
        </div>
      ) : null}
      <div className="gs-card grid gap-3 p-5">
        <label className="text-sm">
          School name
          <input className="gs-input mt-1" value={form.schoolName} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} />
        </label>
        <label className="text-sm">
          Validity Till
          <input className="gs-input mt-1" type="date" value={form.validityTill} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, validityTill: e.target.value }))} required />
        </label>
        <div className="grid gap-1 text-xs text-slate-500">
          <p>Subscription status: {subscription.subscriptionStatus}</p>
          <p>Days remaining: {subscription.daysLabel}</p>
          {form.validityTill ? <p>Current validity: {formatDisplayDate(form.validityTill)}</p> : null}
        </div>
        <label className="text-sm">
          Status
          <select className="gs-input mt-1" value={form.status} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DISABLED">DISABLED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {canEdit ? <button className="gs-btn px-4 py-2">Save Changes</button> : null}
    </form>
  );
}
