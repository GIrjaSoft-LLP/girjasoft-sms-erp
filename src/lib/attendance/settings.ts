import { DEFAULT_ATTENDANCE_SETTINGS, type AttendanceSettings } from "@/config/attendance";
import { Settings } from "@/models/workspace";

export async function getAttendanceSettings(workspaceId: string): Promise<AttendanceSettings> {
  const settings = await Settings.findOne({ workspaceId }).lean();
  const stored = (settings?.attendance ?? {}) as Partial<AttendanceSettings>;
  return {
    ...DEFAULT_ATTENDANCE_SETTINGS,
    ...stored,
    statuses: stored.statuses?.length ? stored.statuses : DEFAULT_ATTENDANCE_SETTINGS.statuses,
  };
}

export async function ensureAttendanceSettings(workspaceId: string) {
  const existing = await Settings.findOne({ workspaceId });
  if (!existing?.attendance || !Object.keys(existing.attendance as object).length) {
    await Settings.findOneAndUpdate(
      { workspaceId },
      { $set: { attendance: DEFAULT_ATTENDANCE_SETTINGS } },
      { upsert: true },
    );
  }
  return getAttendanceSettings(workspaceId);
}

export async function saveAttendanceSettings(workspaceId: string, input: Partial<AttendanceSettings>) {
  const current = await getAttendanceSettings(workspaceId);
  const next = { ...current, ...input };
  await Settings.findOneAndUpdate({ workspaceId }, { $set: { attendance: next } }, { upsert: true });
  return next;
}
