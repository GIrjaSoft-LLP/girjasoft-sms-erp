"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { APP_NAME, APP_VERSION, COMPANY_NAME } from "@/config/branding";

export function AppFooter() {
  const year = new Date().getFullYear();
  const version = APP_VERSION.replace(/^v/i, "");
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-[#eef2f7] px-4 py-2.5 text-xs text-slate-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href="https://girjasoft.com"
            target="_blank"
            rel="noreferrer"
            aria-label="GirjaSoft website"
            className="shrink-0"
          >
            <BrandMark variant="mark" size={28} />
          </a>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#0b1b3a]">{APP_NAME}</p>
            <p className="text-[11px] leading-tight">V{version}</p>
          </div>
        </div>
        <p className="sm:text-center">Powered by GirjaSoft</p>
        <div className="flex flex-col gap-1 sm:items-end">
          <p>
            © {year} {COMPANY_NAME.replace(" LLP", "")}. All rights reserved.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link href="/privacy" className="hover:text-[#4c7eff]">
              Privacy Policy
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/terms" className="hover:text-[#4c7eff]">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
