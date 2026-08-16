import { PlatformAuditLog } from "@/models/platform";
import { AuditLog } from "@/models/workspace";
import { Workspace } from "@/models/platform";
import type { SessionPayload } from "@/lib/session";

export async function logPlatform(
  session: SessionPayload,
  action: string,
  metadata: Record<string, unknown> = {},
  workspaceId: string | null = null,
) {
  await PlatformAuditLog.create({
    actorId: session.sub,
    actorEmail: session.email,
    action,
    workspaceId,
    metadata,
  });
}

export async function logWorkspace(
  session: SessionPayload,
  workspaceId: string,
  action: string,
  entity = "",
  entityId = "",
  metadata: Record<string, unknown> = {},
) {
  await AuditLog.create({
    workspaceId,
    actorId: session.sub,
    actorEmail: session.email,
    action,
    entity,
    entityId,
    metadata,
  });
  await Workspace.findByIdAndUpdate(workspaceId, { lastActivityAt: new Date() });
}
