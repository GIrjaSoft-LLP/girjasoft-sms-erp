import { notFound } from "next/navigation";
import { ModuleManager } from "@/components/ModuleManager";
import { ModulePageGuard } from "@/components/ModulePageGuard";
import { isFinanceResource } from "@/config/nav";

export default async function FinanceModulePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isFinanceResource(resource)) notFound();
  return (
    <ModulePageGuard resourceKey={resource}>
      <ModuleManager resourceKey={resource} />
    </ModulePageGuard>
  );
}
