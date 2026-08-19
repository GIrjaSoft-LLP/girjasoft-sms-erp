"use client";

import { useEffect, useState } from "react";
import type { AttendanceSettings } from "@/config/attendance";
import { api } from "@/lib/client";

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ settings: AttendanceSettings }>("/api/attendance/settings")
      .then((data) => setSettings(data.settings))
      .catch(() => undefined);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const data = await api<{ settings: AttendanceSettings }>("/api/attendance/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
    setSettings(data.settings);
    setMessage("Attendance settings saved.");
  }

  if (!settings) return <p className="text-sm text-slate-500">Loading settings…</p>;

  return (
    <form onSubmit={save} className="gs-card max-w-2xl space-y-4 p-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enableClassAttendance}
          onChange={(e) => setSettings({ ...settings, enableClassAttendance: e.target.checked })}
        />
        Enable Class Attendance
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enableSubjectAttendance}
          onChange={(e) => setSettings({ ...settings, enableSubjectAttendance: e.target.checked })}
        />
        Enable Subject-wise Attendance
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Low Attendance Threshold (%)</span>
        <input
          className="gs-input"
          type="number"
          min={1}
          max={100}
          value={settings.lowAttendanceThreshold}
          onChange={(e) => setSettings({ ...settings, lowAttendanceThreshold: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.allowTeacherEdit}
          onChange={(e) => setSettings({ ...settings, allowTeacherEdit: e.target.checked })}
        />
        Allow teachers to edit submitted attendance
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.lockAfterSubmit}
          onChange={(e) => setSettings({ ...settings, lockAfterSubmit: e.target.checked })}
        />
        Lock attendance after submission
      </label>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <button className="gs-btn px-4 py-2">Save Settings</button>
    </form>
  );
}
