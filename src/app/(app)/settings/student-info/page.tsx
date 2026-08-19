"use client";

import Link from "next/link";

export default function StudentInfoSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold">Student Info Settings</h2>
      <div className="gs-card space-y-3 p-5 text-sm text-slate-600">
        <p>
          Student and parent/guardian management is centralized under the <strong>Student Info</strong> module.
          Parent login accounts are unified — one login can access all linked children.
        </p>
        <p>
          Automatic parent login creation during admission confirmation is configured in{" "}
          <Link href="/settings/admission" className="text-[#4c7eff] hover:underline">
            Admission Settings
          </Link>
          .
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Student records, classes, sections and subjects are managed inside Student Info.</li>
          <li>Parents / guardians are managed inside Student Info, not as a separate ERP module.</li>
          <li>Attendance, fees, examination and other modules remain linked through the central Student record.</li>
        </ul>
      </div>
    </div>
  );
}
