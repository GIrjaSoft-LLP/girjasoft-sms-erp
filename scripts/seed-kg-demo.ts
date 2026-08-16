import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { DEFAULT_USER_PASSWORD } from "../src/config/defaults";
import { hashPassword } from "../src/lib/password";
import { initializeWorkspace } from "../src/lib/workspace-bootstrap";
import { PlatformAdmin, Workspace } from "../src/models/platform";
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
  LeaveType,
  Mark,
  Notice,
  Parent,
  Payroll,
  Result,
  SchoolClass,
  Section,
  Settings,
  Staff,
  Student,
  StudentFee,
  Subject,
  Teacher,
  TeacherAttendance,
  Timetable,
  TransportAssignment,
  TransportRoute,
  Vehicle,
} from "../src/models/workspace";

const WORKSPACE_CODE = "LITTLE-BLOOMS-KG";
const PASSWORD = DEFAULT_USER_PASSWORD;

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
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function removeIncompleteKgWorkspace(workspaceId: mongoose.Types.ObjectId) {
  const filter = { workspaceId };
  await Promise.all([
    User.deleteMany(filter),
    Role.deleteMany(filter),
    Student.deleteMany(filter),
    Parent.deleteMany(filter),
    Teacher.deleteMany(filter),
    Staff.deleteMany(filter),
    SchoolClass.deleteMany(filter),
    Section.deleteMany(filter),
    Subject.deleteMany(filter),
    AcademicSession.deleteMany(filter),
    Attendance.deleteMany(filter),
    TeacherAttendance.deleteMany(filter),
    Timetable.deleteMany(filter),
    Homework.deleteMany(filter),
    Exam.deleteMany(filter),
    Mark.deleteMany(filter),
    Result.deleteMany(filter),
    FeeStructure.deleteMany(filter),
    StudentFee.deleteMany(filter),
    FeePayment.deleteMany(filter),
    Expense.deleteMany(filter),
    Payroll.deleteMany(filter),
    Book.deleteMany(filter),
    BookIssue.deleteMany(filter),
    Vehicle.deleteMany(filter),
    TransportRoute.deleteMany(filter),
    TransportAssignment.deleteMany(filter),
    InventoryItem.deleteMany(filter),
    Notice.deleteMany(filter),
    Settings.deleteMany(filter),
    LeaveType.deleteMany(filter),
  ]);
  await Workspace.deleteOne({ _id: workspaceId });
}

async function main() {
  loadLocalEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp" });

  const existingSchools = await Workspace.find().select("name code schoolName").lean();
  console.log("Existing workspaces (left unchanged):");
  for (const school of existingSchools) {
    console.log(`- ${school.schoolName} [${school.code}]`);
  }

  const already = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (already) {
    const studentCount = await Student.countDocuments({ workspaceId: already._id });
    const adminUser = await User.findOne({ workspaceId: already._id, email: "admin@littleblooms.demo" });
    if (studentCount >= 40 && adminUser) {
      console.log(`\nDemo workspace ${WORKSPACE_CODE} already exists. Existing data was not modified.`);
      await mongoose.disconnect();
      return;
    }
    console.log(`\nRemoving incomplete ${WORKSPACE_CODE} workspace only, then seeding again.`);
    await removeIncompleteKgWorkspace(already._id);
  }

  const passwordHash = await hashPassword(PASSWORD);
  const superAdmin = await PlatformAdmin.findOne({ email: "admin@girjasoft.com" }).select("+passwordHash");
  if (superAdmin) {
    superAdmin.passwordHash = passwordHash;
    await superAdmin.save();
  }

  const workspace = await Workspace.create({
    name: "Little Blooms KG",
    code: WORKSPACE_CODE,
    schoolName: "Little Blooms Kindergarten",
    email: "hello@littleblooms.demo",
    phone: "020-2555-1010",
    address: "12 Blossom Lane, Kothrud",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    pinCode: "411038",
    website: "https://littleblooms.demo",
    academicSession: "2026-2027",
    status: "ACTIVE",
  });
  const workspaceId = workspace._id;
  await initializeWorkspace(String(workspaceId), workspace.schoolName);

  const roles = await Role.find({ workspaceId });
  const role = (slug: string) => {
    const found = roles.find((item) => item.slug === slug);
    if (!found) throw new Error(`Missing role ${slug}`);
    return found._id;
  };

  const session = await AcademicSession.findOne({ workspaceId, isCurrent: true });

  const classDefs = [
    { name: "Pre-Nursery", numericName: 0, sections: ["A", "B"], studentCount: 12, prefix: "PN" },
    { name: "Junior KG", numericName: 1, sections: ["A", "B", "C"], studentCount: 15, prefix: "JK" },
    { name: "Senior KG", numericName: 2, sections: ["A", "B"], studentCount: 14, prefix: "SK" },
  ];

  const classes = [];
  for (const def of classDefs) {
    const schoolClass = await SchoolClass.create({
      workspaceId,
      name: def.name,
      numericName: def.numericName,
      status: "ACTIVE",
    });
    const sections = [];
    for (const sectionName of def.sections) {
      const section = await Section.create({
        workspaceId,
        name: sectionName,
        classId: schoolClass._id,
        capacity: 20,
      });
      sections.push(section);
    }
    const subjects = await Subject.insertMany(
      ["English", "Numbers", "Rhymes", "Art & Craft", "Play Time"].map((name, index) => ({
        workspaceId,
        name,
        code: `${def.prefix}-${name.slice(0, 3).toUpperCase()}${index + 1}`,
        classId: schoolClass._id,
      })),
    );
    classes.push({ ...def, schoolClass, sections, subjects });
  }

  const teacherPeople = [
    { classPrefix: "PN", name: "Anjali Sharma", email: "anjali.sharma@littleblooms.demo", phone: "9876500001", employeeId: "TCH-PN-01", subjects: ["Rhymes", "Play Time"] },
    { classPrefix: "PN", name: "Neha Kulkarni", email: "neha.kulkarni@littleblooms.demo", phone: "9876500002", employeeId: "TCH-PN-02", subjects: ["English", "Art & Craft"] },
    { classPrefix: "JK", name: "Priya Deshmukh", email: "priya.deshmukh@littleblooms.demo", phone: "9876500003", employeeId: "TCH-JK-01", subjects: ["English", "Rhymes"] },
    { classPrefix: "JK", name: "Sneha Patil", email: "sneha.patil@littleblooms.demo", phone: "9876500004", employeeId: "TCH-JK-02", subjects: ["Numbers", "Art & Craft"] },
    { classPrefix: "SK", name: "Meera Joshi", email: "meera.joshi@littleblooms.demo", phone: "9876500005", employeeId: "TCH-SK-01", subjects: ["English", "Numbers"] },
    { classPrefix: "SK", name: "Ritu Banerjee", email: "ritu.banerjee@littleblooms.demo", phone: "9876500006", employeeId: "TCH-SK-02", subjects: ["Rhymes", "Play Time"] },
  ];

  const teachers = [];
  for (const person of teacherPeople) {
    const teacher = await Teacher.create({
      workspaceId,
      ...person,
      department: "Academic",
      status: "ACTIVE",
    });
    const user = await User.create({
      workspaceId,
      name: person.name,
      email: person.email,
      phone: person.phone,
      username: person.email.split("@")[0],
      passwordHash,
      department: "Academic",
      employeeId: person.employeeId,
      roleIds: [role("teacher")],
      linkedTeacherId: teacher._id,
      status: "ACTIVE",
    });
    teachers.push({ ...person, teacher, user });
  }

  const staffMembers = [
    { name: "Rohit Nair", email: "rohit.nair@littleblooms.demo", employeeId: "STF-ACC-01", department: "Finance", designation: "Accountant", role: "accountant" },
    { name: "Kavita Iyer", email: "kavita.iyer@littleblooms.demo", employeeId: "STF-LIB-01", department: "Library", designation: "Librarian", role: "librarian" },
    { name: "Sanjay More", email: "sanjay.more@littleblooms.demo", employeeId: "STF-TRN-01", department: "Transport", designation: "Transport Manager", role: "transport_manager" },
  ];
  for (const member of staffMembers) {
    const staff = await Staff.create({
      workspaceId,
      name: member.name,
      email: member.email,
      phone: "9876500099",
      employeeId: member.employeeId,
      department: member.department,
      designation: member.designation,
      status: "ACTIVE",
    });
    await User.create({
      workspaceId,
      name: member.name,
      email: member.email,
      phone: "9876500099",
      username: member.email.split("@")[0],
      passwordHash,
      department: member.department,
      employeeId: member.employeeId,
      roleIds: [role(member.role)],
      linkedStaffId: staff._id,
      status: "ACTIVE",
    });
  }

  const admin = await User.create({
    workspaceId,
    name: "Sunita Rao",
    email: "admin@littleblooms.demo",
    phone: "9876500000",
    username: "blooms-admin",
    passwordHash,
    department: "Administration",
    employeeId: "ADM-001",
    roleIds: [role("workspace_admin")],
    status: "ACTIVE",
  });
  workspace.adminUserId = admin._id;
  await workspace.save();

  const boyNames = ["Aarav", "Vihaan", "Advait", "Ishaan", "Kabir", "Reyansh", "Shaurya", "Atharv", "Vivaan", "Arjun"];
  const girlNames = ["Anaya", "Myra", "Aadhya", "Kiara", "Diya", "Siya", "Pari", "Aanya", "Ira", "Navya"];
  const lastNames = ["Sharma", "Patil", "Kulkarni", "Deshmukh", "Joshi", "Nair", "Iyer", "Mehta", "Singh", "Gupta"];

  const allStudents: Array<{ student: { _id: mongoose.Types.ObjectId }; classId: mongoose.Types.ObjectId; sectionId: mongoose.Types.ObjectId; name: string }> = [];
  let admissionSerial = 1;

  for (const classItem of classes) {
    const perSection = Math.floor(classItem.studentCount / classItem.sections.length);
    const remainder = classItem.studentCount % classItem.sections.length;
    const sizes = classItem.sections.map((_, index) => perSection + (index < remainder ? 1 : 0));
    let classIndex = 0;
    for (const [sectionIndex, section] of classItem.sections.entries()) {
      const count = sizes[sectionIndex];
      for (let i = 0; i < count; i += 1) {
        const female = classIndex % 2 === 1;
        const first = (female ? girlNames : boyNames)[classIndex % 10];
        const last = lastNames[classIndex % lastNames.length];
        const name = `${first} ${last}`;
        const admissionNumber = `LB-${classItem.prefix}-${String(admissionSerial).padStart(3, "0")}`;
        const parentName = female ? `Mrs. ${last}` : `Mr. ${last}`;
        const parent = await Parent.create({
          workspaceId,
          name: parentName,
          email: `parent.${admissionNumber.toLowerCase()}@littleblooms.demo`,
          phone: `98765${String(10000 + admissionSerial).slice(-5)}`,
          address: `${20 + admissionSerial} Garden View, Pune`,
          status: "ACTIVE",
        });
        const student = await Student.create({
          workspaceId,
          admissionNumber,
          name,
          gender: female ? "Female" : "Male",
          dateOfBirth: classItem.prefix === "PN" ? "2023-06-15" : classItem.prefix === "JK" ? "2022-05-10" : "2021-04-08",
          classId: classItem.schoolClass._id,
          sectionId: section._id,
          parentId: parent._id,
          phone: parent.phone,
          email: `student.${admissionNumber.toLowerCase()}@littleblooms.demo`,
          address: parent.address,
          status: "ACTIVE",
          academicSessionId: session?._id,
        });
        parent.studentIds = [student._id];
        await parent.save();
        allStudents.push({
          student,
          classId: classItem.schoolClass._id,
          sectionId: section._id,
          name,
        });
        if (i === 0) {
          await User.create({
            workspaceId,
            name: parentName,
            email: parent.email,
            phone: parent.phone,
            username: `parent-${admissionNumber.toLowerCase()}`,
            passwordHash,
            department: "Academic",
            employeeId: `PAR-${admissionNumber}`,
            roleIds: [role("parent")],
            linkedParentId: parent._id,
            linkedStudentIds: [student._id],
            linkedStudentId: student._id,
            status: "ACTIVE",
          });
        }
        if (i === 1) {
          await User.create({
            workspaceId,
            name,
            email: `student.${admissionNumber.toLowerCase()}@littleblooms.demo`,
            phone: parent.phone,
            username: admissionNumber.toLowerCase(),
            passwordHash,
            department: "Academic",
            employeeId: `STU-${admissionNumber}`,
            roleIds: [role("student")],
            linkedStudentId: student._id,
            status: "ACTIVE",
          });
        }
        admissionSerial += 1;
        classIndex += 1;
      }
    }
  }

  const feeAmounts: Record<string, number> = { "Pre-Nursery": 4500, "Junior KG": 5200, "Senior KG": 5800 };
  const structures = [];
  for (const classItem of classes) {
    const structure = await FeeStructure.create({
      workspaceId,
      name: `${classItem.name} Monthly Fee`,
      classId: classItem.schoolClass._id,
      amount: feeAmounts[classItem.name],
      frequency: "MONTHLY",
      academicSessionId: session?._id,
    });
    structures.push({ classId: String(classItem.schoolClass._id), structure });
  }

  let receipt = 1;
  for (const [index, item] of allStudents.entries()) {
    const amount = feeAmounts[classes.find((cls) => String(cls.schoolClass._id) === String(item.classId))?.name ?? "Junior KG"];
    const structure = structures.find((row) => row.classId === String(item.classId))?.structure;
    const bucket = index % 3;
    const paidAmount = bucket === 0 ? amount : bucket === 1 ? Math.round(amount / 2) : 0;
    const status = paidAmount === amount ? "PAID" : paidAmount === 0 ? "PENDING" : "PARTIAL";
    const studentFee = await StudentFee.create({
      workspaceId,
      studentId: item.student._id,
      feeStructureId: structure?._id,
      amount,
      dueDate: "2026-08-10",
      status,
      paidAmount,
    });
    if (paidAmount > 0) {
      await FeePayment.create({
        workspaceId,
        studentId: item.student._id,
        studentFeeId: studentFee._id,
        amount: paidAmount,
        method: index % 2 === 0 ? "UPI" : "CASH",
        receiptNumber: `LB-RCP-${String(receipt).padStart(4, "0")}`,
        date: dateOffset(index % 12),
        remarks: status === "PAID" ? "Term fee settled" : "Part payment",
      });
      receipt += 1;
    }
  }

  const bookSets = [
    ["Colouring Fun", "First Rhymes", "My Alphabet", "Play Dough Stories"],
    ["Phonics Reader", "Number World", "Story Time", "Art Pad", "Nature Walk"],
    ["Word Builder", "Math Magic", "Picture Stories", "Craft Book"],
  ];
  for (const [classIndex, classItem] of classes.entries()) {
    const titles = bookSets[classIndex];
    const books = await Book.insertMany(
      titles.map((title, bookIndex) => ({
        workspaceId,
        title: `${classItem.name} - ${title}`,
        author: "Little Blooms Press",
        isbn: `978000${classIndex + 1}${String(bookIndex + 1).padStart(5, "0")}`,
        copies: 8,
        available: 6,
      })),
    );
    const classStudents = allStudents.filter((row) => String(row.classId) === String(classItem.schoolClass._id));
    for (const [bookIndex, book] of books.slice(0, 2).entries()) {
      const student = classStudents[bookIndex];
      if (!student) continue;
      await BookIssue.create({
        workspaceId,
        bookId: book._id,
        studentId: student.student._id,
        issueDate: dateOffset(5),
        dueDate: dateOffset(-9),
        status: "ISSUED",
      });
    }
  }

  for (const classItem of classes) {
    const classTeachers = teachers.filter((person) => person.classPrefix === classItem.prefix);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    for (const section of classItem.sections) {
      for (const [dayIndex, day] of days.entries()) {
        await Timetable.create({
          workspaceId,
          classId: classItem.schoolClass._id,
          sectionId: section._id,
          day,
          period: "1",
          subjectId: classItem.subjects[dayIndex % classItem.subjects.length]._id,
          teacherId: classTeachers[dayIndex % classTeachers.length].teacher._id,
        });
      }
    }
    await Homework.create({
      workspaceId,
      title: `${classItem.name} colouring worksheet`,
      description: "Complete the worksheet and bring it tomorrow.",
      classId: classItem.schoolClass._id,
      sectionId: classItem.sections[0]._id,
      subjectId: classItem.subjects[0]._id,
      dueDate: dateOffset(-2),
      teacherId: classTeachers[0].teacher._id,
    });
  }

  const exam = await Exam.create({
    workspaceId,
    name: "July Fun Assessment",
    academicSessionId: session?._id,
    startDate: "2026-07-15",
    endDate: "2026-07-18",
    status: "COMPLETED",
  });
  for (const item of allStudents) {
    const marksObtained = 70 + (item.name.length % 25);
    await Mark.create({
      workspaceId,
      examId: exam._id,
      studentId: item.student._id,
      marksObtained,
      maxMarks: 100,
      grade: marksObtained >= 85 ? "A" : "B",
    });
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

  for (const item of allStudents) {
    for (const daysAgo of [1, 2, 3]) {
      await Attendance.create({
        workspaceId,
        studentId: item.student._id,
        classId: item.classId,
        sectionId: item.sectionId,
        date: dateOffset(daysAgo),
        status: item.name.length % 7 === daysAgo ? "ABSENT" : "PRESENT",
      });
    }
  }
  for (const person of teachers) {
    await TeacherAttendance.create({
      workspaceId,
      teacherId: person.teacher._id,
      date: dateOffset(1),
      status: "PRESENT",
    });
  }

  await Expense.insertMany([
    { workspaceId, title: "Art supplies", category: "Academic", amount: 8500, date: dateOffset(8), notes: "Crayons and chart paper" },
    { workspaceId, title: "Classroom snacks", category: "Canteen", amount: 4200, date: dateOffset(4), notes: "Weekly fruit" },
    { workspaceId, title: "Printing bills", category: "Admin", amount: 1600, date: dateOffset(2), notes: "Fee receipts" },
  ]);

  for (const person of teachers) {
    await Payroll.create({
      workspaceId,
      staffName: person.name,
      employeeId: person.employeeId,
      month: "2026-07",
      basic: 28000,
      allowances: 4000,
      deductions: 1200,
      netPay: 30800,
      status: "PAID",
    });
  }

  await InventoryItem.create({
    workspaceId,
    name: "Crayon boxes",
    sku: "INV-CRY-01",
    quantity: 40,
    unit: "box",
    location: "Store room",
  });
  await InventoryItem.create({
    workspaceId,
    name: "Story mats",
    sku: "INV-MAT-01",
    quantity: 12,
    unit: "pcs",
    location: "Play area",
  });

  const bus = await Vehicle.create({
    workspaceId,
    number: "MH12-LB-1011",
    type: "BUS",
    capacity: 20,
    driver: "Prakash Yadav",
  });
  const route = await TransportRoute.create({
    workspaceId,
    name: "Kothrud Loop",
    stops: "Kothrud Depot, Paud Road, School Gate",
    vehicleId: bus._id,
  });
  for (const item of allStudents.slice(0, 8)) {
    await TransportAssignment.create({
      workspaceId,
      studentId: item.student._id,
      routeId: route._id,
      vehicleId: bus._id,
      pickupPoint: "Kothrud Depot",
    });
  }

  await Notice.create({
    workspaceId,
    title: "Independence Day celebration",
    body: "Students may come in tricolour dress. Programme starts at 9:00 AM.",
    audience: "ALL",
    date: dateOffset(0),
  });

  console.log("\nLittle Blooms Kindergarten demo workspace created.");
  console.log(`Workspace code: ${WORKSPACE_CODE}`);
  console.log("Admin login: admin@littleblooms.demo");
  console.log(`Password for all demo users: ${PASSWORD}`);
  console.log(`Students: ${allStudents.length}`);
  console.log(`Teachers: ${teachers.length}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
