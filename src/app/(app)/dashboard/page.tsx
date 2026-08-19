"use client";

import { useEffect, useState } from "react";
import { ModuleHomepage } from "@/components/ModuleHomepage";
import { api } from "@/lib/client";

type ModuleCard = {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  category: string;
  accent: string;
};

export default function DashboardPage() {
  const [modules, setModules] = useState<ModuleCard[]>([]);

  useEffect(() => {
    api<{ modules: ModuleCard[] }>("/api/workspace/modules").then((data) => {
      setModules(data.modules);
    });
  }, []);

  return <ModuleHomepage modules={modules} />;
}
