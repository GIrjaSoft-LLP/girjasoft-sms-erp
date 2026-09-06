import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import { logPlatform } from "@/lib/audit";
import type { SessionPayload } from "@/lib/session";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";

export const WORKSPACE_ARCHIVED_LOGIN_MESSAGE =
  "Your workspace has been archived. Please contact the platform administrator for assistance.";

export function isWorkspaceArchived(status?: string | null) {
  return status === "ARCHIVED";
}

export function activeWorkspaceQuery(extra: Record<string, unknown> = {}) {
  return { status: { $ne: "ARCHIVED" }, ...extra };
}

export function archivedWorkspaceQuery(extra: Record<string, unknown> = {}) {
  return { status: "ARCHIVED", ...extra };
}

function isTransactionUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /replica set|transaction numbers|IllegalOperation|Transactions are not supported/i.test(message);
}

async function runAtomically<T>(work: (session: mongoose.ClientSession | null) => Promise<T>) {
  let mongoSession: mongoose.ClientSession | null = null;
  try {
    mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    const result = await work(mongoSession);
    await mongoSession.commitTransaction();
    return result;
  } catch (error) {
    if (mongoSession?.inTransaction()) {
      await mongoSession.abortTransaction();
    }
    if (mongoSession && isTransactionUnsupported(error)) {
      return work(null);
    }
    throw error;
  } finally {
    await mongoSession?.endSession();
  }
}

export async function archiveWorkspace(session: SessionPayload, workspaceId: string) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new ApiError(404, "Workspace not found.");
  if (workspace.status === "ARCHIVED") {
    throw new ApiError(409, "Workspace is already archived.");
  }

  const now = new Date();
  const previousStatus = workspace.status || "ACTIVE";
  const users = await User.find({ workspaceId: workspace._id });
  const userSnapshots = users.map((user) => ({
    id: user._id,
    status: user.status,
    archivedAt: user.archivedAt,
    statusBeforeArchive: user.statusBeforeArchive,
  }));

  try {
    await runAtomically(async (mongoSession) => {
      const opts = mongoSession ? { session: mongoSession } : undefined;
      workspace.statusBeforeArchive = previousStatus;
      workspace.status = "ARCHIVED";
      workspace.archivedAt = now;
      workspace.archivedBy = new mongoose.Types.ObjectId(session.sub);
      workspace.archivedByEmail = session.email;
      await workspace.save(opts);

      for (const user of users) {
        if (user.status === "ARCHIVED") continue;
        user.statusBeforeArchive = user.status || "ACTIVE";
        user.status = "ARCHIVED";
        user.archivedAt = now;
        await user.save(opts);
      }
    });
  } catch (error) {
    workspace.status = previousStatus;
    workspace.statusBeforeArchive = "";
    workspace.archivedAt = null;
    workspace.archivedBy = null;
    workspace.archivedByEmail = "";
    await workspace.save().catch(() => undefined);
    await Promise.all(
      userSnapshots.map((snap) =>
        User.findByIdAndUpdate(snap.id, {
          status: snap.status,
          archivedAt: snap.archivedAt ?? null,
          statusBeforeArchive: snap.statusBeforeArchive ?? "",
        }).catch(() => undefined),
      ),
    );
    throw error;
  }

  await logPlatform(
    session,
    "WORKSPACE_ARCHIVED",
    {
      workspaceId,
      name: workspace.name,
      schoolName: workspace.schoolName,
      code: workspace.code,
      archivedBy: session.email,
      archivedAt: now.toISOString(),
      userCount: users.length,
    },
    workspaceId,
  );

  return { workspace, userCount: users.length };
}

export async function restoreWorkspace(session: SessionPayload, workspaceId: string) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new ApiError(404, "Workspace not found.");
  if (workspace.status !== "ARCHIVED") {
    throw new ApiError(400, "Workspace is not archived.");
  }

  const users = await User.find({ workspaceId: workspace._id, status: "ARCHIVED" });
  const previousWorkspaceStatus = workspace.status;
  const workspaceSnapshot = {
    statusBeforeArchive: workspace.statusBeforeArchive,
    archivedAt: workspace.archivedAt,
    archivedBy: workspace.archivedBy,
    archivedByEmail: workspace.archivedByEmail,
  };
  const userSnapshots = users.map((user) => ({
    id: user._id,
    status: user.status,
    archivedAt: user.archivedAt,
    statusBeforeArchive: user.statusBeforeArchive,
  }));
  const restoreStatus =
    workspace.statusBeforeArchive && workspace.statusBeforeArchive !== "ARCHIVED"
      ? workspace.statusBeforeArchive
      : "ACTIVE";

  try {
    await runAtomically(async (mongoSession) => {
      const opts = mongoSession ? { session: mongoSession } : undefined;
      workspace.status = restoreStatus;
      workspace.statusBeforeArchive = "";
      workspace.archivedAt = null;
      workspace.archivedBy = null;
      workspace.archivedByEmail = "";
      await workspace.save(opts);

      for (const user of users) {
        const nextStatus =
          user.statusBeforeArchive && user.statusBeforeArchive !== "ARCHIVED"
            ? user.statusBeforeArchive
            : "ACTIVE";
        user.status = nextStatus;
        user.statusBeforeArchive = "";
        user.archivedAt = null;
        await user.save(opts);
      }
    });
  } catch (error) {
    workspace.status = previousWorkspaceStatus;
    workspace.statusBeforeArchive = workspaceSnapshot.statusBeforeArchive;
    workspace.archivedAt = workspaceSnapshot.archivedAt;
    workspace.archivedBy = workspaceSnapshot.archivedBy;
    workspace.archivedByEmail = workspaceSnapshot.archivedByEmail;
    await workspace.save().catch(() => undefined);
    await Promise.all(
      userSnapshots.map((snap) =>
        User.findByIdAndUpdate(snap.id, {
          status: snap.status,
          archivedAt: snap.archivedAt ?? null,
          statusBeforeArchive: snap.statusBeforeArchive ?? "",
        }).catch(() => undefined),
      ),
    );
    throw error;
  }

  await logPlatform(
    session,
    "WORKSPACE_RESTORED",
    {
      workspaceId,
      name: workspace.name,
      schoolName: workspace.schoolName,
      code: workspace.code,
      restoredBy: session.email,
      userCount: users.length,
    },
    workspaceId,
  );

  return { workspace, userCount: users.length };
}
