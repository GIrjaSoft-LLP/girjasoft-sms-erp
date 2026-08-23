"use client";

import { useState } from "react";
import { PasswordDialog } from "@/components/PasswordDialog";
import { api } from "@/lib/client";

export default function PlatformChangePasswordPage() {
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState("");

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xl font-semibold gs-heading">Change Password</h2>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {open ? (
        <PasswordDialog
          title="Change password"
          requireCurrent
          onClose={() => setOpen(false)}
          onSave={async () => undefined}
          onSaveWithCurrent={async (currentPassword, newPassword) => {
            await api("/api/auth/change-password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            setMessage("Password updated successfully.");
            setOpen(false);
          }}
        />
      ) : (
        <button type="button" className="gs-btn px-4 py-2 text-sm" onClick={() => setOpen(true)}>
          Change password
        </button>
      )}
    </div>
  );
}
