import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  return (
    <ModulePageGuard resourceKey={resource}>
      <ModuleManager resourceKey={resource} />
    </ModulePageGuard>
  );
}
