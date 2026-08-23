/**
 * Assigns class/section/subject mappings for Priya Sharma (DPS Jaynagar / INBHJYG-001).
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/assign-teacher-priya-dps.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { User } from "../src/models/identity";
import { Section, Subject, Teacher, Timetable } from "../src/models/workspace";

const WORKSPACE_CODE = "INBHJYG-001";
const TEACHER_EMPLOYEE_ID = "DPSST001";

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

const ASSIGNMENTS = [
  { className: "Junior KG", sectionName: "A", subjectName: "English", asClassTeacher: true },
  { className: "Junior KG", sectionName: "B", subjectName: "English", asClassTeacher: false },
  { className: "Senior KG", sectionName: "A", subjectName: "Hindi", asClassTeacher: false },
] as const;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/girjasoft_sms_erp");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("MongoDB connection is not ready.");
    process.exit(1);
  }

  const workspace = await db.collection("workspaces").findOne({ code: WORKSPACE_CODE });
  if (!workspace) {
    console.error(`Workspace ${WORKSPACE_CODE} not found.`);
    process.exit(1);
  }

  const workspaceId = workspace._id;
  const teacher = await Teacher.findOne({ workspaceId, employeeId: TEACHER_EMPLOYEE_ID });
  if (!teacher) {
    console.error(`Teacher ${TEACHER_EMPLOYEE_ID} not found in ${WORKSPACE_CODE}.`);
    process.exit(1);
  }

  const teacherId = teacher._id;
  let timetableCreated = 0;
  let classTeacherSet = 0;

  for (const assignment of ASSIGNMENTS) {
    const classDoc = await db.collection("classes").findOne({ workspaceId, name: assignment.className });
    if (!classDoc) {
      console.warn(`Class not found: ${assignment.className}`);
      continue;
    }

    const section = await Section.findOne({
      workspaceId,
      classId: classDoc._id,
      name: assignment.sectionName,
    });
    if (!section) {
      console.warn(`Section not found: ${assignment.className} ${assignment.sectionName}`);
      continue;
    }

    const subject = await Subject.findOne({
      workspaceId,
      classId: classDoc._id,
      name: assignment.subjectName,
    });
    if (!subject) {
      console.warn(`Subject not found: ${assignment.className} ${assignment.subjectName}`);
      continue;
    }

    if (assignment.asClassTeacher && !section.classTeacherId) {
      section.classTeacherId = teacherId;
      await section.save();
      classTeacherSet += 1;
    }

    for (const day of WEEKDAYS) {
      const exists = await Timetable.findOne({
        workspaceId,
        classId: classDoc._id,
        sectionId: section._id,
        subjectId: subject._id,
        teacherId,
        day,
        period: "1",
      });
      if (exists) continue;
      await Timetable.create({
        workspaceId,
        classId: classDoc._id,
        sectionId: section._id,
        subjectId: subject._id,
        teacherId,
        day,
        period: "1",
      });
      timetableCreated += 1;
    }
  }

  if (teacher.staffId) {
    await User.updateMany(
      { workspaceId, linkedTeacherId: teacherId },
      { $set: { linkedStaffId: teacher.staffId } },
    );
  }

  const { getTeacherAssignmentOptions } = await import("../src/lib/teacher-context");
  const { assignments } = await getTeacherAssignmentOptions(String(workspaceId), String(teacherId));

  console.log(`Assigned teacher ${teacher.name} (${TEACHER_EMPLOYEE_ID}) in ${WORKSPACE_CODE}.`);
  console.log(`  Class teacher sections set: ${classTeacherSet}`);
  console.log(`  Timetable slots created: ${timetableCreated}`);
  console.log(`  Assignment options now: ${assignments.length}`);
  for (const item of assignments) {
    console.log(`    - ${item.label}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
