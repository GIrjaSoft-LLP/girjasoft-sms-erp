import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { ATTENDANCE_STATUSES } from "../src/config/attendance";
import { ensureAttendanceSettings } from "../src/lib/attendance/settings";
import { Workspace } from "../src/models/platform";
import {
  AcademicSession,
  Attendance,
  AttendanceSession,
  SchoolClass,
  Section,
  Student,
  Subject,
  Teacher,
  Timetable,
} from "../src/models/workspace";

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

function pickStatus(seed: number) {
  const pool = ATTENDANCE_STATUSES;
  return pool[seed % pool.length];
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
  await ensureAttendanceSettings(workspaceId);

  const db = mongoose.connection.db;
  if (db) {
    const attendanceCol = db.collection("attendance");
    try {
      await attendanceCol.dropIndex("workspaceId_1_studentId_1_date_1");
      console.log("Dropped legacy attendance index workspaceId_1_studentId_1_date_1");
    } catch {
      // Index may not exist after migration.
    }
    await Attendance.updateMany(
      { workspaceId, $or: [{ attendanceType: { $exists: false } }, { attendanceType: null }] },
      { $set: { attendanceType: "CLASS", subjectId: null } },
    );
  }

  const [teachers, sections, students, subjects, session] = await Promise.all([
    Teacher.find({ workspaceId }).limit(20).lean(),
    Section.find({ workspaceId }).lean(),
    Student.find({ workspaceId, status: "ACTIVE" }).lean(),
    Subject.find({ workspaceId }).lean(),
    AcademicSession.findOne({ workspaceId, isCurrent: true }).lean(),
  ]);

  let sectionsUpdated = 0;
  for (const [index, section] of sections.entries()) {
    const teacher = teachers[index % teachers.length];
    if (teacher && !section.classTeacherId) {
      await Section.findByIdAndUpdate(section._id, { $set: { classTeacherId: teacher._id } });
      sectionsUpdated += 1;
    }
  }

  let timetableCreated = 0;
  for (const [index, section] of sections.entries()) {
    const classSubjects = subjects.filter((item) => String(item.classId) === String(section.classId)).slice(0, 4);
    for (const [subjectIndex, subject] of classSubjects.entries()) {
      const teacher = teachers[(index + subjectIndex) % teachers.length];
      const exists = await Timetable.findOne({
        workspaceId,
        classId: section.classId,
        sectionId: section._id,
        subjectId: subject._id,
        day: "Monday",
        period: "1",
      });
      if (exists) continue;
      await Timetable.create({
        workspaceId,
        classId: section.classId,
        sectionId: section._id,
        subjectId: subject._id,
        teacherId: teacher?._id ?? null,
        day: "Monday",
        period: String(subjectIndex + 1),
      });
      timetableCreated += 1;
    }
  }

  const dates: string[] = [];
  for (let offset = 0; offset < 20; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }

  let classSessions = 0;
  let subjectSessions = 0;

  for (const section of sections.slice(0, 8)) {
    const sectionStudents = students.filter((student) => String(student.sectionId) === String(section._id));
    if (!sectionStudents.length) continue;

    for (const date of dates) {
      const records = sectionStudents.map((student, index) => ({
        studentId: student._id,
        status: pickStatus(index + date.length),
        remarks: "",
      }));
      const counts = {
        present: records.filter((row) => row.status === "PRESENT").length,
        absent: records.filter((row) => row.status === "ABSENT").length,
        late: records.filter((row) => row.status === "LATE").length,
        leave: records.filter((row) => row.status === "LEAVE").length,
      };

      const sessionDoc = await AttendanceSession.findOneAndUpdate(
        {
          workspaceId,
          academicSessionId: session?._id ?? null,
          date,
          classId: section.classId,
          sectionId: section._id,
          attendanceType: "CLASS",
          subjectId: null,
        },
        {
          $set: {
            status: "SUBMITTED",
            totalStudents: records.length,
            presentCount: counts.present,
            absentCount: counts.absent,
            lateCount: counts.late,
            leaveCount: counts.leave,
            markedBy: "seed",
            markedByEmail: "seed@demo.local",
            markedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      classSessions += 1;

      for (const record of records) {
        const student = sectionStudents.find((row) => String(row._id) === String(record.studentId));
        await Attendance.findOneAndUpdate(
          {
            workspaceId,
            studentId: record.studentId,
            date,
            attendanceType: "CLASS",
            subjectId: null,
          },
          {
            $set: {
              academicSessionId: session?._id ?? null,
              classId: section.classId,
              sectionId: section._id,
              sessionId: sessionDoc._id,
              status: record.status,
              remarks: record.remarks,
              markedBy: "seed",
              markedAt: new Date(),
            },
          },
          { upsert: true },
        );
      }

      const classSubjects = subjects.filter((item) => String(item.classId) === String(section.classId)).slice(0, 2);
      for (const subject of classSubjects) {
        const subjectRecords = sectionStudents.map((student, index) => ({
          studentId: student._id,
          status: pickStatus(index + subject.name.length),
          remarks: "",
        }));
        const subjectCounts = {
          present: subjectRecords.filter((row) => row.status === "PRESENT").length,
          absent: subjectRecords.filter((row) => row.status === "ABSENT").length,
          late: subjectRecords.filter((row) => row.status === "LATE").length,
          leave: subjectRecords.filter((row) => row.status === "LEAVE").length,
        };
        const subjectSession = await AttendanceSession.findOneAndUpdate(
          {
            workspaceId,
            academicSessionId: session?._id ?? null,
            date,
            classId: section.classId,
            sectionId: section._id,
            attendanceType: "SUBJECT",
            subjectId: subject._id,
          },
          {
            $set: {
              status: "SUBMITTED",
              totalStudents: subjectRecords.length,
              presentCount: subjectCounts.present,
              absentCount: subjectCounts.absent,
              lateCount: subjectCounts.late,
              leaveCount: subjectCounts.leave,
              markedBy: "seed",
              markedByEmail: "seed@demo.local",
              markedAt: new Date(),
            },
          },
          { upsert: true, new: true },
        );
        subjectSessions += 1;

        for (const record of subjectRecords) {
          await Attendance.findOneAndUpdate(
            {
              workspaceId,
              studentId: record.studentId,
              date,
              attendanceType: "SUBJECT",
              subjectId: subject._id,
            },
            {
              $set: {
                academicSessionId: session?._id ?? null,
                classId: section.classId,
                sectionId: section._id,
                sessionId: subjectSession._id,
                status: record.status,
                remarks: record.remarks,
                markedBy: "seed",
                markedAt: new Date(),
              },
            },
            { upsert: true },
          );
        }
      }
    }
  }

  console.log(
    `Attendance seed complete for ${workspace.code}. Sections updated: ${sectionsUpdated}, timetable: ${timetableCreated}, class sessions: ${classSessions}, subject sessions: ${subjectSessions}.`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exit(1);
});
