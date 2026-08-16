"use client";

import { useEffect, useState } from "react";
import { PhotoField } from "@/components/PhotoField";
import { api } from "@/lib/client";

type Me = {
  name: string;
  email: string;
  sessionRole?: string;
  roleSlugs?: string[];
  accountType?: string;
  linkedStudentId?: string | null;
  linkedStudentIds?: string[];
  linkedTeacherId?: string | null;
};

type Person = {
  _id: string;
  name: string;
  photo?: string;
  admissionNumber?: string;
  employeeId?: string;
  className?: string;
  sectionName?: string;
};

async function savePhoto(kind: "students" | "teachers", id: string, file: File | null, remove: boolean) {
  if (file) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/${kind}/${id}/photo`, { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { error?: string }).error || "Photo upload failed");
    return String((data as { photoUrl?: string }).photoUrl ?? `/api/${kind}/${id}/photo`);
  }
  if (remove) {
    const response = await fetch(`/api/${kind}/${id}/photo`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((data as { error?: string }).error || "Could not remove photo");
    return "";
  }
  return undefined;
}

export default function ProfilePage() {
  const [user, setUser] = useState<Me | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [kind, setKind] = useState<"students" | "teachers" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPeople(me: Me) {
    const slugs = me.roleSlugs ?? [];
    if (slugs.includes("parent") || slugs.includes("student")) {
      const data = await api<{ items: Person[] }>("/api/students");
      setKind("students");
      setPeople(data.items);
      return;
    }
    if (slugs.includes("teacher")) {
      const data = await api<{ items: Person[] }>("/api/teachers");
      setKind("teachers");
      setPeople(data.items);
    }
  }

  useEffect(() => {
    api<{ user: Me }>("/api/auth/me")
      .then(async (data) => {
        setUser(data.user);
        await loadPeople(data.user);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">My Profile</h1>
      <div className="gs-card p-5 space-y-3 text-sm">
        <p>
          <span className="text-slate-500">Name</span>
          <span className="mt-1 block font-medium">{user?.name ?? "—"}</span>
        </p>
        <p>
          <span className="text-slate-500">Email</span>
          <span className="mt-1 block font-medium">{user?.email ?? "—"}</span>
        </p>
        <p>
          <span className="text-slate-500">Account</span>
          <span className="mt-1 block font-medium">{user?.accountType ?? "—"}</span>
        </p>
        <p>
          <span className="text-slate-500">Roles</span>
          <span className="mt-1 block font-medium">
            {user?.roleSlugs?.length ? user.roleSlugs.join(", ") : user?.sessionRole ?? "—"}
          </span>
        </p>
        <p className="text-slate-500">
          Use the user menu in the header to change your password or sign out.
        </p>
      </div>

      {kind && people.length ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {kind === "teachers" ? "Teacher photo" : user?.roleSlugs?.includes("parent") ? "My children" : "Student photo"}
          </h2>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {people.map((person) => (
            <div key={person._id} className="gs-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-slate-500">
                    {person.admissionNumber
                      ? `${person.admissionNumber}${person.className ? ` · ${person.className} ${person.sectionName ?? ""}` : ""}`
                      : person.employeeId || ""}
                  </p>
                </div>
                <a
                  className="text-sm text-emerald-700"
                  href={`/print/id-cards?kind=${kind}&ids=${person._id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download ID Card
                </a>
              </div>
              <PhotoField
                label="Photo"
                name={person.name}
                photo={person.photo ? `/api/${kind}/${person._id}/photo` : ""}
                onPhotoChange={async (file, remove) => {
                  setError("");
                  setMessage("");
                  try {
                    const photo = await savePhoto(kind, person._id, file, remove);
                    if (photo !== undefined) {
                      setPeople((rows) => rows.map((row) => (row._id === person._id ? { ...row, photo } : row)));
                      setMessage("Photo updated.");
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Photo update failed");
                  }
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
