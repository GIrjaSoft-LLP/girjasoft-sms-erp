"use client";

import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function PaymentsPage() {
  return (
    <ModulePageGuard resourceKey="payments">
      <p className="mb-3 text-sm text-slate-500">
        Parent receipt uploads appear as <strong>Pending Verification</strong>. Open View Receipt to approve or reject.
        Approved payments update the student fee balance automatically.
      </p>
      <ModuleManager resourceKey="payments" />
    </ModulePageGuard>
  );
}
