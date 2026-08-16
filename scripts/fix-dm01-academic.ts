import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { Workspace } from "../src/models/platform";
import {
  Exam,
  Homework,
  Mark,
  Result,
  SchoolClass,
  Section,
  Student,
  Subject,
  Teacher,
  Timetable,
} from "../src/models/workspace";

const WORKSPACE_CODE = "GIRJSOFT-DM-01";
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = ["1", "2", "3", "4", "5"];
const MARK_SUBJECTS = ["English", "Mathematics", "Rhymes"];

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

function gradeFor(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });

  const workspace = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (!workspace) {
    throw new Error("Workspace GIRJSOFT-DM-01 was not found. No data was changed.");
  }
  const workspaceId = workspace._id;
  console.log(`Fixing academic lists for ${workspace.schoolName} [${WORKSPACE_CODE}]`);

  const classes = await SchoolClass.find({ workspaceId }).sort({ numericName: 1 });
  const sections = await Section.find({ workspaceId }).sort({ name: 1 });
  const teachers = await Teacher.find({ workspaceId }).sort({ employeeId: 1 });
  const subjects = await Subject.find({ workspaceId });
  const students = await Student.find({ workspaceId }).sort({ admissionNumber: 1 });

  await Timetable.deleteMany({ workspaceId });
  await Homework.deleteMany({ workspaceId });
  await Mark.deleteMany({ workspaceId });
  await Result.deleteMany({ workspaceId });

  const homeworkTasks = [
    ["English", "Trace the letters and colour the pictures."],
    ["Mathematics", "Count and circle the correct number of objects."],
    ["Rhymes", "Practise the rhyme and recite it in class."],
  ] as const;

  for (const schoolClass of classes) {
    const classSections = sections.filter((row) => String(row.classId) === String(schoolClass._id));
    const classSubjects = subjects.filter((row) => String(row.classId) === String(schoolClass._id));
    const classTeachers = teachers.filter((row) => row.department?.startsWith(schoolClass.name));

    for (const section of classSections) {
      const sectionTeachers = classTeachers.filter((row) => row.department?.includes(`/ ${section.name}`));
      for (const [dayIndex, day] of WEEK_DAYS.entries()) {
        for (const [periodIndex, period] of PERIODS.entries()) {
          const subject = classSubjects[(dayIndex + periodIndex) % Math.max(classSubjects.length, 1)];
          const teacher = sectionTeachers[(periodIndex + dayIndex) % Math.max(sectionTeachers.length, 1)] ?? classTeachers[periodIndex % Math.max(classTeachers.length, 1)];
          if (!subject || !teacher) continue;
          await Timetable.create({
            workspaceId,
            classId: schoolClass._id,
            sectionId: section._id,
            day,
            period,
            subjectId: subject._id,
            teacherId: teacher._id,
          });
        }
      }

      for (const [taskIndex, [subjectName, description]] of homeworkTasks.entries()) {
        const subject =
          classSubjects.find((row) => row.name === subjectName) ?? classSubjects[taskIndex % Math.max(classSubjects.length, 1)];
        const teacher = sectionTeachers[taskIndex % Math.max(sectionTeachers.length, 1)] ?? classTeachers[0];
        if (!subject) continue;
        await Homework.create({
          workspaceId,
          title: `${schoolClass.name} ${section.name} — ${subject.name} practice`,
          description,
          classId: schoolClass._id,
          sectionId: section._id,
          subjectId: subject._id,
          teacherId: teacher?._id ?? null,
          dueDate: `2026-08-${String(18 + taskIndex).padStart(2, "0")}`,
        });
      }
    }
  }

  let exam = await Exam.findOne({ workspaceId, name: "July Fun Assessment" });
  if (!exam) {
    exam = await Exam.create({
      workspaceId,
      name: "July Fun Assessment",
      startDate: "2026-07-15",
      endDate: "2026-07-18",
      status: "COMPLETED",
    });
  }

  for (const student of students) {
    const classSubjects = subjects.filter((row) => String(row.classId) === String(student.classId));
    const chosen = MARK_SUBJECTS.map(
      (name) => classSubjects.find((row) => row.name === name) ?? classSubjects[0],
    ).filter(Boolean);
    let total = 0;
    const maxTotal = chosen.length * 50;
    for (const [index, subject] of chosen.entries()) {
      const obtained = 32 + ((Number(String(student.admissionNumber).slice(-2)) + index * 7) % 18);
      total += obtained;
      await Mark.create({
        workspaceId,
        examId: exam._id,
        studentId: student._id,
        subjectId: subject._id,
        marksObtained: obtained,
        maxMarks: 50,
        grade: gradeFor((obtained / 50) * 100),
      });
    }
    const percentage = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
    await Result.create({
      workspaceId,
      examId: exam._id,
      studentId: student._id,
      totalMarks: total,
      percentage,
      grade: gradeFor(percentage),
      status: percentage >= 40 ? "PASS" : "FAIL",
    });
  }

  const report = {
    workspaceId: WORKSPACE_CODE,
    classes: classes.length,
    sections: sections.length,
    students: students.length,
    timetable: await Timetable.countDocuments({ workspaceId }),
    homework: await Homework.countDocuments({ workspaceId }),
    marks: await Mark.countDocuments({ workspaceId }),
    results: await Result.countDocuments({ workspaceId }),
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
