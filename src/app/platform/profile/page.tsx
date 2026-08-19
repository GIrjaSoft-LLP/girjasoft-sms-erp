"use client";

import { useEffect, useState } from "react";
import { PhotoField } from "@/components/PhotoField";
import { api } from "@/lib/client";

export default function PlatformProfilePage() {
  const [user, setUser] = useState<{ name: string; email: string; roleSlugs?: string[] } | null>(null);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: { name: string; email: string; roleSlugs?: string[]; photo?: string } }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setPhoto(data.user.photo ?? "/api/platform/profile/photo");
      })
      .catch(() => undefined);
  }, []);

  async function savePhoto(file: File | null, remove: boolean) {
    setError("");
    setMessage("");
    try {
      if (file) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/platform/profile/photo", { method: "POST", body });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((data as { error?: string }).error || "Upload failed");
        setPhoto(String((data as { photoUrl?: string }).photoUrl ?? "/api/platform/profile/photo"));
      } else if (remove) {
        const response = await fetch("/api/platform/profile/photo", { method: "DELETE" });
        if (!response.ok) throw new Error("Could not remove photo");
        setPhoto("");
      }
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo update failed");
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#0b1b3a]">My Profile</h1>
        <p className="text-sm text-slate-500">Manage your platform account photo.</p>
      </div>
      <div className="gs-card space-y-3 p-5 text-sm">
        <p><span className="text-slate-500">Name</span><span className="mt-1 block font-medium">{user?.name ?? "—"}</span></p>
        <p><span className="text-slate-500">Email</span><span className="mt-1 block font-medium">{user?.email ?? "—"}</span></p>
        <p><span className="text-slate-500">Role</span><span className="mt-1 block font-medium">{user?.roleSlugs?.join(", ") ?? "—"}</span></p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <div className="gs-card p-5">
        <PhotoField label="Profile Photo" name={user?.name ?? ""} photo={photo} onPhotoChange={savePhoto} />
      </div>
    </div>
  );
}
