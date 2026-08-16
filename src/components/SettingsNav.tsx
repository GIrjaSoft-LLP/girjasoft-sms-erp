"use client";

import { SectionTabs } from "@/components/SectionTabs";
import { SETTINGS_NAV } from "@/config/nav";

export function SettingsNav() {
  return <SectionTabs items={SETTINGS_NAV} rootPath="/settings" />;
}
