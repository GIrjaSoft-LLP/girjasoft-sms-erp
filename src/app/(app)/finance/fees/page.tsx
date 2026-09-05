"use client";

import { useState } from "react";
import { CreateStudentFeesDialog } from "@/components/fees/CreateStudentFeesDialog";
import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default function FeesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [listKey, setListKey] = useState(0);

  return (
    <ModulePageGuard resourceKey="fees">
      <ModuleManager
        key={listKey}
        resourceKey="fees"
        onCreateClick={() => setCreateOpen(true)}
      />
      {createOpen ? (
        <CreateStudentFeesDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => setListKey((value) => value + 1)}
        />
      ) : null}
    </ModulePageGuard>
  );
}
