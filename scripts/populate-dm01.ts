import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_USER_PASSWORD } from "../src/config/defaults";
import { hashPassword } from "../src/lib/password";
import { Workspace } from "../src/models/platform";
import { Role, User } from "../src/models/identity";
import {
  AcademicSession,
  Attendance,
  Book,
  BookIssue,
  Exam,
  Expense,
  FeePayment,
  FeeStructure,
  Homework,
  InventoryItem,
  Mark,
  Notice,
  Parent,
  Payroll,
  Result,
  SchoolClass,
  Section,
  Student,
  StudentFee,
  Subject,
  Teacher,
  TeacherAttendance,
  Timetable,
} from "../src/models/workspace";

const WORKSPACE_CODE = "GIRJSOFT-DM-01";
const DEMO_PASSWORD = DEFAULT_USER_PASSWORD;

const CLASS_PLAN = [
  {
    name: "Pre-Nursery",
    numericName: 0,
    prefix: "PN",
    dob: "2023-07-15",
    tuition: 3500,
    sectionSize: 12,
    paid: 7,
    partial: 3,
    pending: 2,
    books: ["My First English Book", "Fun With Numbers", "Rhymes for Kids", "Drawing & Coloring"],
  },
  {
    name: "Junior KG",
    numericName: 1,
    prefix: "JK",
    dob: "2022-06-10",
    tuition: 3800,
    sectionSize: 10,
    paid: 6,
    partial: 2,
    pending: 2,
    books: ["Junior English Reader", "Junior Mathematics", "Hindi Varnmala", "Rhymes & Poems"],
  },
  {
    name: "Senior KG",
    numericName: 2,
    prefix: "SK",
    dob: "2021-05-08",
    tuition: 4000,
    sectionSize: 14,
    paid: 8,
    partial: 3,
    pending: 3,
    books: [
      "Senior English Reader",
      "Senior Mathematics",
      "Hindi Learning Book",
      "General Awareness",
      "Art & Activity Book",
    ],
  },
] as const;

const SUBJECTS = ["English", "Hindi", "Mathematics", "General Awareness", "Rhymes", "Art & Craft"];
const SECTIONS = ["A", "B", "C"] as const;

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

function dateOffset(days: number) {
  const date = new Date("2026-08-14");
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });

  const workspace = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (!workspace) {
    throw new Error("Workspace GIRJSOFT-DM-01 was not found. No data was created.");
  }
  const workspaceId = workspace._id;
  console.log(`Populating only ${workspace.schoolName} [${WORKSPACE_CODE}] ${String(workspaceId)}`);

  const existingStudents = await Student.countDocuments({
    workspaceId,
    admissionNumber: { $regex: /^DM01-/ },
  });
  if (existingStudents >= 100) {
    console.log("Demo academic data already exists in this workspace. Skipping insert.");
    await mongoose.disconnect();
    return;
  }

  const roles = await Role.find({ workspaceId });
  const roleId = (slug: string) => {
    const found = roles.find((item) => item.slug === slug);
    if (!found) throw new Error(`Missing role ${slug} in ${WORKSPACE_CODE}`);
    return found._id;
  };

  let session = await AcademicSession.findOne({ workspaceId, isCurrent: true });
  if (!session) {
    session = await AcademicSession.create({
      workspaceId,
      name: "2026-2027",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isCurrent: true,
    });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const classes = [];

  for (const plan of CLASS_PLAN) {
    let schoolClass = await SchoolClass.findOne({ workspaceId, name: plan.name });
    if (!schoolClass) {
      schoolClass = await SchoolClass.create({
        workspaceId,
        name: plan.name,
        numericName: plan.numericName,
        status: "ACTIVE",
      });
    }
    const sections = [];
    for (const sectionName of SECTIONS) {
      let section = await Section.findOne({ workspaceId, classId: schoolClass._id, name: sectionName });
      if (!section) {
        section = await Section.create({
          workspaceId,
          name: sectionName,
          classId: schoolClass._id,
          capacity: 20,
        });
      }
      sections.push(section);
    }
    const subjects = [];
    for (const [index, subjectName] of SUBJECTS.entries()) {
      const code = `${plan.prefix}-${subjectName.slice(0, 3).toUpperCase()}${index + 1}`;
      let subject = await Subject.findOne({ workspaceId, code });
      if (!subject) {
        subject = await Subject.create({
          workspaceId,
          name: subjectName,
          code,
          classId: schoolClass._id,
        });
      }
      subjects.push(subject);
    }
    classes.push({ plan, schoolClass, sections, subjects });
  }

  const teachers = [];
  let teacherNumber = 1;
  for (const classItem of classes) {
    for (const section of classItem.sections) {
      for (let slot = 0; slot < 2; slot += 1) {
        const name = `Teacher${teacherNumber}`;
        const email = `teacher${teacherNumber}@girjasoft.com`;
        const employeeId = `TCH-${String(teacherNumber).padStart(2, "0")}`;
        let teacher = await Teacher.findOne({ workspaceId, employeeId });
        if (!teacher) {
          teacher = await Teacher.create({
            workspaceId,
            employeeId,
            name,
            email,
            phone: `90000${String(10000 + teacherNumber).slice(-5)}`,
            department: `${classItem.plan.name} / ${section.name}`,
            subjects: [classItem.subjects[slot].name, classItem.subjects[slot + 2].name],
            status: "ACTIVE",
          });
        }
        const existingUser = await User.findOne({ workspaceId, email });
        if (!existingUser) {
          await User.create({
            workspaceId,
            name,
            email,
            phone: teacher.phone,
            username: `teacher${teacherNumber}`,
            passwordHash,
            department: teacher.department,
            employeeId,
            roleIds: [roleId("teacher")],
            linkedTeacherId: teacher._id,
            status: "ACTIVE",
          });
        }
        teachers.push({ teacher, classItem, section, teacherNumber });
        teacherNumber += 1;
      }
    }
  }

  const students: Array<{
    student: { _id: mongoose.Types.ObjectId };
    classItem: (typeof classes)[number];
    section: { _id: mongoose.Types.ObjectId; name: string };
    indexInSection: number;
    number: number;
  }> = [];
  let studentNumber = 1;
  for (const classItem of classes) {
    for (const section of classItem.sections) {
      for (let i = 0; i < classItem.plan.sectionSize; i += 1) {
        const admissionNumber = `DM01-${String(studentNumber).padStart(4, "0")}`;
        const name = `Student${studentNumber}`;
        const parentName = `Parent${studentNumber}`;
        const gender = studentNumber % 2 === 0 ? "Female" : "Male";
        let parent = await Parent.findOne({ workspaceId, email: `parent${studentNumber}@demo.girjasoft.in` });
        if (!parent) {
          parent = await Parent.create({
            workspaceId,
            name: parentName,
            email: `parent${studentNumber}@demo.girjasoft.in`,
            phone: `91000${String(10000 + studentNumber).slice(-5)}`,
            address: `${studentNumber} Demo Lane, Pune`,
            status: "ACTIVE",
          });
        }
        let student = await Student.findOne({ workspaceId, admissionNumber });
        if (!student) {
          student = await Student.create({
            workspaceId,
            admissionNumber,
            name,
            gender,
            dateOfBirth: classItem.plan.dob,
            classId: classItem.schoolClass._id,
            sectionId: section._id,
            parentId: parent._id,
            phone: parent.phone,
            email: `student${studentNumber}@demo.girjasoft.in`,
            address: parent.address,
            status: "ACTIVE",
            academicSessionId: session._id,
          });
        }
        parent.studentIds = [student._id];
        await parent.save();
        if (i === 0) {
          const parentEmail = `parent-s${section.name.toLowerCase()}-${classItem.plan.prefix.toLowerCase()}@demo.girjasoft.in`;
          const exists = await User.findOne({ workspaceId, email: parentEmail });
          if (!exists) {
            await User.create({
              workspaceId,
              name: parentName,
              email: parentEmail,
              phone: parent.phone,
              username: `parent${studentNumber}`,
              passwordHash,
              department: "Academic",
              employeeId: `PAR-${admissionNumber}`,
              roleIds: [roleId("parent")],
              linkedParentId: parent._id,
              linkedStudentIds: [student._id],
              linkedStudentId: student._id,
              status: "ACTIVE",
            });
          }
        }
        students.push({ student, classItem, section, indexInSection: i, number: studentNumber });
        studentNumber += 1;
      }
    }
  }

  for (const classItem of classes) {
    for (const fee of [
      { name: `${classItem.plan.name} Admission Fee`, amount: 8000 },
      { name: `${classItem.plan.name} Tuition Fee`, amount: classItem.plan.tuition },
      { name: `${classItem.plan.name} Annual Charges`, amount: 2500 },
      { name: `${classItem.plan.name} Activity Fee`, amount: 1200 },
      { name: `${classItem.plan.name} Transport Fee`, amount: 1500 },
      { name: `${classItem.plan.name} Library Fee`, amount: 400 },
      { name: `${classItem.plan.name} Examination Fee`, amount: 600 },
    ]) {
      const exists = await FeeStructure.findOne({ workspaceId, name: fee.name, classId: classItem.schoolClass._id });
      if (!exists) {
        await FeeStructure.create({
          workspaceId,
          name: fee.name,
          classId: classItem.schoolClass._id,
          amount: fee.amount,
          frequency: fee.name.includes("Tuition") ? "MONTHLY" : "ANNUAL",
          academicSessionId: session._id,
        });
      }
    }
  }

  let receipt = 1;
  const methods = ["CASH", "UPI", "BANK", "CARD"];
  for (const item of students) {
    const { paid, partial, pending, tuition } = item.classItem.plan;
    let status: "PAID" | "PARTIAL" | "PENDING" = "PENDING";
    let paidAmount = 0;
    if (item.indexInSection < paid) {
      status = "PAID";
      paidAmount = tuition;
    } else if (item.indexInSection < paid + partial) {
      status = "PARTIAL";
      paidAmount = Math.round(tuition / 2);
    } else if (item.indexInSection < paid + partial + pending) {
      status = "PENDING";
      paidAmount = 0;
    } else {
      status = "PAID";
      paidAmount = tuition;
    }
    const structure = await FeeStructure.findOne({
      workspaceId,
      classId: item.classItem.schoolClass._id,
      name: `${item.classItem.plan.name} Tuition Fee`,
    });
    const existingFee = await StudentFee.findOne({ workspaceId, studentId: item.student._id });
    let studentFee = existingFee;
    if (!studentFee) {
      studentFee = await StudentFee.create({
        workspaceId,
        studentId: item.student._id,
        feeStructureId: structure?._id,
        amount: tuition,
        dueDate: "2026-08-10",
        status,
        paidAmount,
      });
    }
    if (paidAmount > 0) {
      const receiptNumber = `REC-DM-${String(receipt).padStart(4, "0")}`;
      const exists = await FeePayment.findOne({ workspaceId, receiptNumber });
      if (!exists) {
        await FeePayment.create({
          workspaceId,
          studentId: item.student._id,
          studentFeeId: studentFee._id,
          amount: paidAmount,
          method: methods[item.number % methods.length],
          receiptNumber,
          date: dateOffset(item.number % 20),
          remarks: status === "PAID" ? "Tuition settled TXN-DM-" + String(item.number).padStart(4, "0") : "Part payment TXN-DM-" + String(item.number).padStart(4, "0"),
        });
      }
      receipt += 1;
    }
  }

  for (const [classIndex, classItem] of classes.entries()) {
    for (const [bookIndex, title] of classItem.plan.books.entries()) {
      const isbn = `978DM${classIndex + 1}${String(bookIndex + 1).padStart(6, "0")}`;
      let book = await Book.findOne({ workspaceId, isbn });
      if (!book) {
        book = await Book.create({
          workspaceId,
          title,
          author: "GirjaSoft Demo Press",
          isbn,
          copies: 10,
          available: bookIndex === 0 ? 8 : 10,
        });
      }
      if (bookIndex === 0) {
        const first = students.find((row) => String(row.classItem.schoolClass._id) === String(classItem.schoolClass._id));
        if (first) {
          const issued = await BookIssue.findOne({ workspaceId, bookId: book._id, studentId: first.student._id });
          if (!issued) {
            await BookIssue.create({
              workspaceId,
              bookId: book._id,
              studentId: first.student._id,
              issueDate: "2026-08-01",
              dueDate: "2026-08-15",
              status: "ISSUED",
            });
          }
        }
      }
      if (bookIndex === 1) {
        const second = students.filter((row) => String(row.classItem.schoolClass._id) === String(classItem.schoolClass._id))[1];
        if (second) {
          const returned = await BookIssue.findOne({ workspaceId, bookId: book._id, studentId: second.student._id });
          if (!returned) {
            await BookIssue.create({
              workspaceId,
              bookId: book._id,
              studentId: second.student._id,
              issueDate: "2026-07-10",
              dueDate: "2026-07-24",
              returnDate: "2026-07-22",
              status: "RETURNED",
            });
          }
        }
      }
    }
  }

  const days = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
  for (const item of students) {
    for (const [dayIndex, date] of days.entries()) {
      const exists = await Attendance.findOne({ workspaceId, studentId: item.student._id, date });
      if (exists) continue;
      const roll = (item.number + dayIndex) % 40;
      const status = roll === 0 ? "LEAVE" : roll <= 2 ? "ABSENT" : "PRESENT";
      await Attendance.create({
        workspaceId,
        studentId: item.student._id,
        classId: item.classItem.schoolClass._id,
        sectionId: item.section._id,
        date,
        status,
      });
    }
  }

  for (const person of teachers) {
    const exists = await TeacherAttendance.findOne({
      workspaceId,
      teacherId: person.teacher._id,
      date: "2026-08-14",
    });
    if (!exists) {
      await TeacherAttendance.create({
        workspaceId,
        teacherId: person.teacher._id,
        date: "2026-08-14",
        status: "PRESENT",
      });
    }
  }

  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  for (const person of teachers) {
    for (const [index, day] of weekDays.entries()) {
      const exists = await Timetable.findOne({
        workspaceId,
        classId: person.classItem.schoolClass._id,
        sectionId: person.section._id,
        day,
        period: String((person.teacherNumber % 2) + 1),
      });
      if (!exists) {
        await Timetable.create({
          workspaceId,
          classId: person.classItem.schoolClass._id,
          sectionId: person.section._id,
          day,
          period: String((person.teacherNumber % 2) + 1),
          subjectId: person.classItem.subjects[index % person.classItem.subjects.length]._id,
          teacherId: person.teacher._id,
        });
      }
    }
  }

  for (const classItem of classes) {
    const exists = await Homework.findOne({ workspaceId, title: `${classItem.plan.name} colouring practice` });
    if (!exists) {
      await Homework.create({
        workspaceId,
        title: `${classItem.plan.name} colouring practice`,
        description: "Complete the worksheet and bring it tomorrow.",
        classId: classItem.schoolClass._id,
        sectionId: classItem.sections[0]._id,
        dueDate: "2026-08-18",
      });
    }
  }

  let exam = await Exam.findOne({ workspaceId, name: "July Fun Assessment" });
  if (!exam) {
    exam = await Exam.create({
      workspaceId,
      name: "July Fun Assessment",
      academicSessionId: session._id,
      startDate: "2026-07-15",
      endDate: "2026-07-18",
      status: "COMPLETED",
    });
  }
  for (const item of students) {
    const marksObtained = 72 + (item.number % 23);
    const existingMark = await Mark.findOne({ workspaceId, examId: exam._id, studentId: item.student._id });
    if (!existingMark) {
      await Mark.create({
        workspaceId,
        examId: exam._id,
        studentId: item.student._id,
        marksObtained,
        maxMarks: 100,
        grade: marksObtained >= 85 ? "A" : "B",
      });
    }
    const existingResult = await Result.findOne({ workspaceId, examId: exam._id, studentId: item.student._id });
    if (!existingResult) {
      await Result.create({
        workspaceId,
        examId: exam._id,
        studentId: item.student._id,
        totalMarks: marksObtained,
        percentage: marksObtained,
        grade: marksObtained >= 85 ? "A" : "B",
        status: "PASS",
      });
    }
  }

  const bills = [
    ["Electricity", "Demo Facility Services", 12400],
    ["Internet", "Demo Internet Services", 3500],
    ["Stationery", "Demo Stationery Suppliers", 6800],
    ["Cleaning", "Demo Facility Services", 4200],
    ["School Supplies", "Demo Education Supplies", 9100],
    ["Maintenance", "Demo Maintenance Services", 15000],
    ["Teaching Material", "Demo Education Supplies", 5400],
    ["Furniture", "Demo Education Supplies", 22000],
    ["Water", "Demo Facility Services", 1800],
    ["Security", "Demo Facility Services", 12000],
    ["Electricity", "Demo Facility Services", 11850],
    ["Internet", "Demo Internet Services", 3500],
    ["Stationery", "Demo Stationery Suppliers", 2750],
    ["Cleaning", "Demo Facility Services", 4100],
    ["School Supplies", "Demo Education Supplies", 6400],
    ["Maintenance", "Demo Maintenance Services", 8700],
    ["Teaching Material", "Demo Education Supplies", 3900],
    ["Water", "Demo Facility Services", 1750],
    ["Security", "Demo Facility Services", 12000],
    ["Furniture", "Demo Education Supplies", 9800],
  ] as const;
  for (const [index, [category, vendor, amount]] of bills.entries()) {
    const title = `BILL-DM-${String(index + 1).padStart(4, "0")} ${category}`;
    const exists = await Expense.findOne({ workspaceId, title });
    if (!exists) {
      await Expense.create({
        workspaceId,
        title,
        category,
        amount,
        date: dateOffset(index),
        notes: `${vendor} / Invoice BILL-DM-${String(index + 1).padStart(4, "0")} / ${index % 3 === 0 ? "PENDING" : "PAID"}`,
      });
    }
  }

  for (const person of teachers) {
    const exists = await Payroll.findOne({
      workspaceId,
      employeeId: person.teacher.employeeId,
      month: "2026-07",
    });
    if (!exists) {
      await Payroll.create({
        workspaceId,
        staffName: person.teacher.name,
        employeeId: person.teacher.employeeId,
        month: "2026-07",
        basic: 25000,
        allowances: 3500,
        deductions: 1000,
        netPay: 27500,
        status: "PAID",
      });
    }
  }

  const crayons = await InventoryItem.findOne({ workspaceId, sku: "DM-CRY-01" });
  if (!crayons) {
    await InventoryItem.create({
      workspaceId,
      name: "Crayon boxes",
      sku: "DM-CRY-01",
      quantity: 48,
      unit: "box",
      location: "Store",
    });
  }
  const notice = await Notice.findOne({ workspaceId, title: "Independence Day celebration" });
  if (!notice) {
    await Notice.create({
      workspaceId,
      title: "Independence Day celebration",
      body: "Students may come in tricolour dress. Programme starts at 9:00 AM.",
      audience: "ALL",
      date: "2026-08-14",
    });
  }

  const paidFees = await StudentFee.countDocuments({ workspaceId, status: "PAID" });
  const pendingFees = await StudentFee.countDocuments({ workspaceId, status: { $in: ["PENDING", "PARTIAL"] } });
  const report = {
    workspaceId: WORKSPACE_CODE,
    classes: await SchoolClass.countDocuments({ workspaceId }),
    sections: await Section.countDocuments({ workspaceId }),
    students: await Student.countDocuments({ workspaceId }),
    teachers: await Teacher.countDocuments({ workspaceId }),
    books: await Book.countDocuments({ workspaceId }),
    paidFees,
    pendingFees,
    expenses: await Expense.countDocuments({ workspaceId }),
    attendance: await Attendance.countDocuments({ workspaceId }),
    parents: await Parent.countDocuments({ workspaceId }),
    payments: await FeePayment.countDocuments({ workspaceId }),
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
