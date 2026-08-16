"use client";

import { BrandMark } from "@/components/BrandMark";
import { APP_NAME } from "@/config/branding";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div className="h-full overflow-y-auto grid place-items-center bg-[#f3f6fb] p-6">
      <div className="gs-card p-8 max-w-lg text-center space-y-3">
        <BrandMark />
        <h1 className="text-xl font-semibold">{APP_NAME}</h1>
        <p className="text-slate-600">Something went wrong.</p>
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    </div>
  );
}
