import { ModuleManager } from "@/components/ModuleManager";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  return <ModuleManager resourceKey={resource} />;
}
