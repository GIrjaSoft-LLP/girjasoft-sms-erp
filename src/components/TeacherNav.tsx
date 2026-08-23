"use client";

import { SectionTabs } from "@/components/SectionTabs";
import { TEACHER_NAV, TEACHER_PORTAL_NAV } from "@/config/teacher";

export function TeacherNav({ portal = false }: { portal?: boolean }) {
  return <SectionTabs items={portal ? TEACHER_PORTAL_NAV : TEACHER_NAV} rootPath="/modules/teacher" />;
}
