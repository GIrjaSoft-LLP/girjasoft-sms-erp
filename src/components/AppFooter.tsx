"use client";

import { BrandMark } from "@/components/BrandMark";

export function AppFooter() {
  return (
    <footer className="app-footer shrink-0 border-t border-slate-200 bg-[#eef2f7] text-slate-500">
      <div className="footer-left">
        <BrandMark variant="mark" size={28} />
        <span className="font-semibold text-[#0b1b3a]">Girja SMS ERP</span>
      </div>
      <div className="footer-right">
        Powered by{" "}
        <a
          href="https://girjasoft.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#0b1b3a] hover:text-[#4c7eff]"
        >
          GirjaSoft
        </a>
      </div>
    </footer>
  );
}
