import mongoose from "mongoose";
import { Role } from "@/models/identity";
import { Settings, AcademicSession, LeaveType } from "@/models/workspace";
import { Workspace } from "@/models/platform";
import { getDefaultRoleDefinitions } from "@/lib/rbac";

export async function initializeWorkspace(workspaceId: string, schoolName: string) {
  const id = new mongoose.Types.ObjectId(workspaceId);
  const defs = getDefaultRoleDefinitions();
  await Role.insertMany(
    defs.map((role) => ({
      workspaceId: id,
      ...role,
    })),
  );

  await Settings.create({
    workspaceId: id,
    organization: { schoolName },
    academic: { gradeSystem: "A-F" },
    finance: { currency: "INR", receiptPrefix: "GS" },
    attendance: { lateAfterMinutes: 15 },
    examination: { passingPercentage: 33 },
    communication: { email: true, sms: false, whatsapp: false },
  });

  const year = new Date().getFullYear();
  await AcademicSession.create({
    workspaceId: id,
    name: `${year}-${year + 1}`,
    startDate: `${year}-04-01`,
    endDate: `${year + 1}-03-31`,
    isCurrent: true,
  });

  await LeaveType.insertMany([
    { workspaceId: id, name: "Casual Leave", days: 12 },
    { workspaceId: id, name: "Sick Leave", days: 8 },
  ]);

  await Workspace.findByIdAndUpdate(id, {
    academicSession: `${year}-${year + 1}`,
  });
}

export function nextWorkspaceCode(existingCodes: string[]) {
  const numbers = existingCodes
    .map((code) => {
      const match = code.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `GIRJA-SCHOOL-${String(next).padStart(3, "0")}`;
}
