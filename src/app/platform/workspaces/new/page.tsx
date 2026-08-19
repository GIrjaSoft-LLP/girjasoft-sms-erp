"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_USER_PASSWORD } from "@/config/defaults";
import { api } from "@/lib/client";

function defaultValidityTill() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const empty = {
  name: "",
  code: "",
  schoolName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pinCode: "",
  website: "",
  logo: "",
  academicSession: "",
  status: "ACTIVE",
  validityTill: defaultValidityTill(),
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  username: "",
  password: DEFAULT_USER_PASSWORD,
  confirmPassword: DEFAULT_USER_PASSWORD,
};

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await api("/api/platform/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          code: form.code || undefined,
          schoolName: form.schoolName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          country: form.country,
          pinCode: form.pinCode,
          website: form.website,
          logo: form.logo,
          academicSession: form.academicSession,
          validityTill: form.validityTill,
          status: form.status,
          admin: {
            name: form.adminName,
            email: form.adminEmail,
            phone: form.adminPhone,
            username: form.username,
            password: form.password,
          },
        }),
      });
      router.push("/platform/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  const fields: Array<[keyof typeof empty, string]> = [
    ["name", "Workspace Name"],
    ["code", "Workspace Code"],
    ["schoolName", "School Name"],
    ["email", "School Email"],
    ["phone", "Phone"],
    ["address", "Address"],
    ["city", "City"],
    ["state", "State"],
    ["country", "Country"],
    ["pinCode", "PIN Code"],
    ["website", "Website"],
    ["logo", "Logo URL"],
    ["academicSession", "Academic Session"],
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-[#0b1b3a]">Create Workspace</h1>
      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        {fields.map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input className="gs-input mt-1" value={form[key]} onChange={(e) => set(key, e.target.value)} required={["name", "schoolName", "email"].includes(key)} />
          </label>
        ))}
        <label className="text-sm">
          Validity Till
          <input className="gs-input mt-1" type="date" value={form.validityTill} onChange={(e) => set("validityTill", e.target.value)} required />
        </label>
        <label className="text-sm">
          Workspace Status
          <select className="gs-input mt-1" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>DISABLED</option>
            <option>ARCHIVED</option>
          </select>
        </label>
      </div>
      <div className="gs-card p-5 grid md:grid-cols-2 gap-3">
        <h2 className="md:col-span-2 text-lg font-semibold">Create Workspace Administrator</h2>
        <label className="text-sm">Admin Name<input className="gs-input mt-1" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} required /></label>
        <label className="text-sm">Admin Email<input className="gs-input mt-1" type="email" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} required /></label>
        <label className="text-sm">Phone<input className="gs-input mt-1" value={form.adminPhone} onChange={(e) => set("adminPhone", e.target.value)} /></label>
        <label className="text-sm">Username<input className="gs-input mt-1" value={form.username} onChange={(e) => set("username", e.target.value)} required /></label>
        <label className="text-sm">Password<input className="gs-input mt-1" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={10} /></label>
        <label className="text-sm">Confirm Password<input className="gs-input mt-1" type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} required /></label>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <button className="gs-btn px-5 py-3">Create Workspace</button>
    </form>
  );
}
