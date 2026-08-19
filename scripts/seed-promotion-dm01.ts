import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { createInitialEnrollment } from "../src/lib/enrollment/service";
import { Workspace } from "../src/models/platform";
import { AcademicSession, SchoolClass, Section, Student, StudentEnrollment } from "../src/models/workspace";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp" });

  const workspace = await Workspace.findOne({ code: "GIRJSOFT-DM-01" });
  if (!workspace) {
    console.error("Demo workspace GIRJSOFT-DM-01 not found.");
    process.exit(1);
  }

  const workspaceId = String(workspace._id);
  const students = await Student.find({ workspaceId }).lean();
  let created = 0;
  let skipped = 0;

  for (const student of students) {
    if (!student.academicSessionId || !student.classId || !student.sectionId) {
      skipped += 1;
      continue;
    }
    const exists = await StudentEnrollment.findOne({
      workspaceId,
      studentId: student._id,
      academicSessionId: student.academicSessionId,
    });
    if (exists) {
      if (!student.currentEnrollmentId) {
        await Student.findByIdAndUpdate(student._id, { $set: { currentEnrollmentId: exists._id } });
      }
      skipped += 1;
      continue;
    }
    await createInitialEnrollment({
      workspaceId,
      studentId: String(student._id),
      academicSessionId: String(student.academicSessionId),
      classId: String(student.classId),
      sectionId: String(student.sectionId),
      rollNumber: String((created % 40) + 1),
      changedBy: "seed",
      changedByEmail: "seed@demo.local",
    });
    created += 1;
  }

  const currentSession = await AcademicSession.findOne({ workspaceId, isCurrent: true }).lean();
  const classes = await SchoolClass.find({ workspaceId }).sort({ numericName: 1 }).lean();
  if (currentSession && classes.length > 1) {
    const nextYear = Number.parseInt(currentSession.name.slice(0, 4), 10) + 1;
    const nextName = `${nextYear}-${String(nextYear + 1).slice(-2)}`;
    let nextSession = await AcademicSession.findOne({ workspaceId, name: nextName });
    if (!nextSession) {
      nextSession = await AcademicSession.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        name: nextName,
        startDate: `${nextYear}-04-01`,
        endDate: `${nextYear + 1}-03-31`,
        isCurrent: false,
      });
      console.log(`Created next academic session: ${nextName}`);
    }
  }

  console.log(`Enrollment backfill complete. Created: ${created}, skipped: ${skipped}.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exit(1);
});
