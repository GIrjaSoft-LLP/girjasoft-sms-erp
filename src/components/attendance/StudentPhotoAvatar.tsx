"use client";

import { useState } from "react";

export function StudentPhotoAvatar({ studentId, name }: { studentId: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/students/${studentId}/photo`}
        alt=""
        className="h-9 w-9 rounded-full object-cover bg-slate-100"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0b1b3a] text-[10px] font-semibold text-white">
      {letters || "—"}
    </div>
  );
}
