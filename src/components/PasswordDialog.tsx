"use client";

import { useState } from "react";

type Props = {
  title: string;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
  requireCurrent?: boolean;
  onSaveWithCurrent?: (currentPassword: string, password: string) => Promise<void>;
};

export function PasswordDialog({
  title,
  onClose,
  onSave,
  requireCurrent,
  onSaveWithCurrent,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
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
    setBusy(true);
    try {
      if (requireCurrent && onSaveWithCurrent) {
        await onSaveWithCurrent(currentPassword, password);
      } else {
        await onSave(password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form onSubmit={submit} className="gs-card w-full max-w-md p-6 space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {requireCurrent ? (
          <label className="block text-sm">
            Current password
            <input
              className="gs-input mt-1"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
        ) : null}
        <label className="block text-sm">
          New password
          <input
            className="gs-input mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
        </label>
        <label className="block text-sm">
          Confirm password
          <input
            className="gs-input mt-1"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="gs-btn px-4 py-2 text-sm" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>
    </div>
  );
}
