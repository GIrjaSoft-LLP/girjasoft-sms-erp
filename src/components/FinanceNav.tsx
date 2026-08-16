"use client";

import { SectionTabs } from "@/components/SectionTabs";
import { FINANCE_NAV } from "@/config/nav";

export function FinanceNav() {
  return <SectionTabs items={FINANCE_NAV} rootPath="/finance" />;
}
