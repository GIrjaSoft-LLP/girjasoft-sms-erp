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
  Document,
  Exam,
  ExamSchedule,
  FeeStructure,
  Homework,
  InventoryItem,
  InventoryTransaction,
  LeaveRequest,
  LeaveType,
  Notice,
  Notification,
  Parent,
  Payroll,
  SalaryStructure,
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

const WORKSPACE_CODE = "GIRJSOFT-DM-01";

const BOYS = [
  "Aarav", "Vihaan", "Advait", "Ishaan", "Kabir", "Reyansh", "Arjun", "Vivaan", "Shaurya", "Atharv",
  "Rohan", "Yash", "Dev", "Ayaan", "Krish", "Om", "Samar", "Dhruv", "Neil", "Harsh",
];
const GIRLS = [
  "Ananya", "Diya", "Aadhya", "Myra", "Kiara", "Saanvi", "Anvi", "Pari", "Ira", "Avni",
  "Riya", "Meera", "Nisha", "Tanvi", "Ishita", "Kavya", "Siya", "Aisha", "Trisha", "Pihu",
];
const SURNAMES = [
  "Patil", "Kulkarni", "Deshmukh", "Joshi", "Sharma", "Kamble", "More", "Pawar", "Bhosale", "Naik",
  "Iyer", "Reddy", "Singh", "Verma", "Gupta", "Deshpande", "Jadhav", "Chavan", "Kadam", "Salunkhe",
];
const FATHERS = ["Rajesh", "Suresh", "Amit", "Nitin", "Prakash", "Sanjay", "Vikram", "Manoj", "Rahul", "Deepak"];
const MOTHERS = ["Sunita", "Priya", "Kavita", "Sneha", "Pooja", "Anita", "Meena", "Rekha", "Neha", "Shweta"];
const PUNE_AREAS = [
  ["12, Karve Road, Kothrud", "Kothrud"],
  ["45, FC Road, Shivajinagar", "Shivajinagar"],
  ["8, Magarpatta Road, Hadapsar", "Hadapsar"],
  ["21, Aundh Road, Baner", "Baner"],
  ["33, Sinhagad Road, Vadgaon", "Vadgaon"],
  ["19, Nagar Road, Viman Nagar", "Viman Nagar"],
  ["7, Paud Road, Bavdhan", "Bavdhan"],
  ["54, Satara Road, Bibwewadi", "Bibwewadi"],
];
const TEACHER_NAMES = [
  "Anjali Deshpande", "Neha Kulkarni", "Priya Joshi", "Meera Patil", "Sneha Sharma", "Kavita More",
  "Pooja Deshmukh", "Anita Pawar", "Rekha Naik", "Shweta Iyer", "Rashmi Reddy", "Deepa Singh",
  "Smita Verma", "Gauri Gupta", "Pallavi Jadhav", "Nisha Chavan", "Asha Kadam", "Lata Salunkhe",
];

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

function weekdays(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function studentNumber(admissionNumber: string) {
  const match = admissionNumber.match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });

  const workspace = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (!workspace) throw new Error("Workspace GIRJSOFT-DM-01 was not found.");
  const workspaceId = workspace._id;
  const passwordHash = await hashPassword(DEFAULT_USER_PASSWORD);
  const roleId = async (slug: string) => {
    const role = await Role.findOne({ workspaceId, slug });
    if (!role) throw new Error(`Missing role ${slug}`);
    return role._id;
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

  await Settings.findOneAndUpdate(
    { workspaceId },
    {
      $set: {
        organization: {
          schoolName: workspace.schoolName,
          address: workspace.address || "Survey No. 12, Baner, Pune 411045",
          phone: workspace.phone || "020-25678900",
          email: workspace.email || "office@girjasoftdemo.in",
        },
        academic: { gradeSystem: "A-F", currentSession: session.name },
        finance: { currency: "INR", receiptPrefix: "REC-DM" },
        attendance: { lateAfterMinutes: 15 },
        examination: { passingPercentage: 40 },
        communication: { email: true, sms: false, whatsapp: false },
      },
    },
    { upsert: true },
  );

  const classes = await SchoolClass.find({ workspaceId }).sort({ numericName: 1 });
  const sections = await Section.find({ workspaceId });
  const subjects = await Subject.find({ workspaceId });
  const teachers = await Teacher.find({ workspaceId }).sort({ employeeId: 1 });
  const students = await Student.find({ workspaceId }).sort({ admissionNumber: 1 });
  const parents = await Parent.find({ workspaceId });

  for (const student of students) {
    const n = studentNumber(student.admissionNumber);
    const gender = n % 2 === 0 ? "Female" : "Male";
    const first = gender === "Female" ? GIRLS[n % GIRLS.length] : BOYS[n % BOYS.length];
    const last = SURNAMES[n % SURNAMES.length];
    const area = PUNE_AREAS[n % PUNE_AREAS.length];
    const dobBase = student.dateOfBirth || "2022-06-10";
    const dob = new Date(`${dobBase}T00:00:00.000Z`);
    dob.setUTCDate(dob.getUTCDate() + (n % 28));
    if (/^Student\d+$/i.test(student.name) || !student.name.includes(" ")) {
      student.name = `${first} ${last}`;
    }
    student.gender = gender;
    student.dateOfBirth = dob.toISOString().slice(0, 10);
    student.address = `${area[0]}, Pune 4110${String(10 + (n % 80)).padStart(2, "0")}`;
    student.academicSessionId = session._id;
    student.status = student.status || "ACTIVE";
    await student.save();

    if (student.parentId) {
      const parent = parents.find((row) => String(row._id) === String(student.parentId));
      if (parent) {
        const guardianFirst = n % 3 === 0 ? MOTHERS[n % MOTHERS.length] : FATHERS[n % FATHERS.length];
        if (/^Parent\d+$/i.test(parent.name) || parent.name.startsWith("Parent")) {
          parent.name = `${guardianFirst} ${last}`;
        }
        parent.address = student.address;
        parent.studentIds = [student._id];
        parent.status = "ACTIVE";
        await parent.save();
        await User.updateMany(
          { workspaceId, linkedParentId: parent._id },
          { $set: { name: parent.name, phone: parent.phone, linkedStudentIds: [student._id], linkedStudentId: student._id } },
        );
      }
    }
  }

  for (const [index, teacher] of teachers.entries()) {
    const name = TEACHER_NAMES[index] ?? `Teacher ${teacher.employeeId}`;
    if (/^Teacher\d+$/i.test(teacher.name)) {
      teacher.name = name;
      await teacher.save();
      await User.updateMany({ workspaceId, linkedTeacherId: teacher._id }, { $set: { name } });
    }
  }

  const staffPlan = [
    { name: "Meera Kulkarni", employeeId: "STF-01", designation: "Accountant", department: "Finance", email: "meera.accounts@girjasoft.com", username: "meera.accounts", slug: "accountant" },
    { name: "Sandeep Joshi", employeeId: "STF-02", designation: "HR Manager", department: "HR", email: "sandeep.hr@girjasoft.com", username: "sandeep.hr", slug: "hr_manager" },
    { name: "Vaishali Gokhale", employeeId: "STF-03", designation: "Librarian", department: "Library", email: "vaishali.library@girjasoft.com", username: "vaishali.library", slug: "librarian" },
    { name: "Ramesh Pawar", employeeId: "STF-04", designation: "Transport Incharge", department: "Transport", email: "ramesh.transport@girjasoft.com", username: "ramesh.transport", slug: "transport_manager" },
    { name: "Sunita Bhosale", employeeId: "STF-05", designation: "Front Office Executive", department: "Administration", email: "sunita.office@girjasoft.com", username: "sunita.office", slug: "" },
    { name: "Ganesh Kamble", employeeId: "STF-06", designation: "Support Staff", department: "Administration", email: "ganesh.support@girjasoft.com", username: "ganesh.support", slug: "" },
  ] as const;

  const staffRecords = [];
  for (const plan of staffPlan) {
    let staff = await Staff.findOne({ workspaceId, employeeId: plan.employeeId });
    if (!staff) {
      staff = await Staff.create({
        workspaceId,
        employeeId: plan.employeeId,
        name: plan.name,
        email: plan.email,
        phone: `98220${plan.employeeId.slice(-2)}123`,
        department: plan.department,
        designation: plan.designation,
        status: "ACTIVE",
      });
    }
    staffRecords.push(staff);
    const exists = await User.findOne({ workspaceId, email: plan.email });
    if (!exists && plan.slug) {
      await User.create({
        workspaceId,
        name: plan.name,
        email: plan.email,
        phone: staff.phone,
        username: plan.username,
        passwordHash,
        department: plan.department,
        employeeId: plan.employeeId,
        roleIds: [await roleId(plan.slug)],
        linkedStaffId: staff._id,
        status: "ACTIVE",
      });
    }
  }

  for (const teacher of teachers) {
    const exists = await SalaryStructure.findOne({ workspaceId, teacherId: teacher._id });
    if (!exists) {
      await SalaryStructure.create({
        workspaceId,
        teacherId: teacher._id,
        basic: 25000,
        allowances: 3500,
        deductions: 1000,
      });
    }
    const august = await Payroll.findOne({ workspaceId, employeeId: teacher.employeeId, month: "2026-08" });
    if (!august) {
      await Payroll.create({
        workspaceId,
        staffName: teacher.name,
        employeeId: teacher.employeeId,
        month: "2026-08",
        basic: 25000,
        allowances: 3500,
        deductions: 1000,
        netPay: 27500,
        status: "DRAFT",
      });
    }
  }

  for (const [index, staff] of staffRecords.entries()) {
    const basic = 18000 + index * 1500;
    const exists = await SalaryStructure.findOne({ workspaceId, staffId: staff._id });
    if (!exists) {
      await SalaryStructure.create({
        workspaceId,
        staffId: staff._id,
        basic,
        allowances: 2000,
        deductions: 800,
      });
    }
    const july = await Payroll.findOne({ workspaceId, employeeId: staff.employeeId, month: "2026-07" });
    if (!july) {
      await Payroll.create({
        workspaceId,
        staffName: staff.name,
        employeeId: staff.employeeId,
        month: "2026-07",
        basic,
        allowances: 2000,
        deductions: 800,
        netPay: basic + 1200,
        status: "PAID",
      });
    }
  }

  for (const name of ["Casual Leave", "Sick Leave", "Earned Leave"]) {
    const days = name === "Sick Leave" ? 8 : name === "Earned Leave" ? 15 : 12;
    const exists = await LeaveType.findOne({ workspaceId, name });
    if (!exists) await LeaveType.create({ workspaceId, name, days });
  }
  const casual = await LeaveType.findOne({ workspaceId, name: "Casual Leave" });
  const sick = await LeaveType.findOne({ workspaceId, name: "Sick Leave" });
  const leaveSamples = [
    { requesterName: teachers[0]?.name ?? "Anjali Deshpande", leaveTypeId: casual?._id, fromDate: "2026-08-04", toDate: "2026-08-04", reason: "Family function in Pune", status: "APPROVED" },
    { requesterName: teachers[3]?.name ?? "Meera Patil", leaveTypeId: sick?._id, fromDate: "2026-08-11", toDate: "2026-08-12", reason: "Fever and rest advised", status: "APPROVED" },
    { requesterName: staffRecords[1]?.name ?? "Sandeep Joshi", leaveTypeId: casual?._id, fromDate: "2026-08-18", toDate: "2026-08-18", reason: "Bank work", status: "PENDING" },
    { requesterName: teachers[8]?.name ?? "Rekha Naik", leaveTypeId: casual?._id, fromDate: "2026-07-28", toDate: "2026-07-28", reason: "Personal work", status: "REJECTED" },
  ];
  for (const row of leaveSamples) {
    const exists = await LeaveRequest.findOne({ workspaceId, requesterName: row.requesterName, fromDate: row.fromDate });
    if (!exists) await LeaveRequest.create({ workspaceId, ...row });
  }

  const buses = [
    { number: "MH-12-GS-4501", type: "BUS", capacity: 40, driver: "Santosh Kale" },
    { number: "MH-12-GS-4502", type: "BUS", capacity: 36, driver: "Prakash Jadhav" },
  ];
  const vehicles = [];
  for (const bus of buses) {
    let vehicle = await Vehicle.findOne({ workspaceId, number: bus.number });
    if (!vehicle) vehicle = await Vehicle.create({ workspaceId, ...bus });
    vehicles.push(vehicle);
  }
  const routePlan = [
    { name: "Kothrud–Baner Loop", stops: "Kothrud Depot, Paud Road, Baner, School gate", vehicle: vehicles[0], pickups: ["Kothrud Depot", "Paud Road", "Baner"] },
    { name: "Hadapsar–Magarpatta Loop", stops: "Hadapsar Gadital, Magarpatta, Nagar Road, School gate", vehicle: vehicles[1], pickups: ["Hadapsar Gadital", "Magarpatta", "Nagar Road"] },
  ];
  const routes = [];
  for (const plan of routePlan) {
    let route = await TransportRoute.findOne({ workspaceId, name: plan.name });
    if (!route) {
      route = await TransportRoute.create({
        workspaceId,
        name: plan.name,
        stops: plan.stops,
        vehicleId: plan.vehicle?._id,
      });
    }
    routes.push({ ...plan, route });
  }

  for (const [index, student] of students.entries()) {
    if (index % 3 !== 0) continue;
    const pack = routes[index % routes.length];
    const exists = await TransportAssignment.findOne({ workspaceId, studentId: student._id });
    if (!exists) {
      await TransportAssignment.create({
        workspaceId,
        studentId: student._id,
        routeId: pack.route._id,
        vehicleId: pack.vehicle?._id,
        pickupPoint: pack.pickups[index % pack.pickups.length],
      });
    }
  }

  const assignedIds = new Set(
    (await TransportAssignment.find({ workspaceId }).select("studentId")).map((row) => String(row.studentId)),
  );
  for (const student of students) {
    const schoolClass = classes.find((row) => String(row._id) === String(student.classId));
    if (!schoolClass) continue;
    const heads = await FeeStructure.find({ workspaceId, classId: schoolClass._id });
    for (const head of heads) {
      if (head.name.includes("Tuition")) continue;
      if (head.name.includes("Transport") && !assignedIds.has(String(student._id))) continue;
      const exists = await StudentFee.findOne({ workspaceId, studentId: student._id, feeStructureId: head._id });
      if (exists) continue;
      const paid = head.name.includes("Admission") || head.name.includes("Library");
      await StudentFee.create({
        workspaceId,
        studentId: student._id,
        feeStructureId: head._id,
        amount: head.amount,
        dueDate: head.name.includes("Annual") ? "2026-06-15" : "2026-08-10",
        status: paid ? "PAID" : "PENDING",
        paidAmount: paid ? head.amount : 0,
      });
    }
  }

  const attendanceDates = weekdays("2026-08-03", "2026-08-14");
  const attendanceDocs = [];
  for (const student of students) {
    for (const [dayIndex, date] of attendanceDates.entries()) {
      const n = studentNumber(student.admissionNumber);
      const roll = (n + dayIndex) % 40;
      attendanceDocs.push({
        updateOne: {
          filter: { workspaceId, studentId: student._id, date },
          update: {
            $setOnInsert: {
              workspaceId,
              studentId: student._id,
              classId: student.classId,
              sectionId: student.sectionId,
              date,
              status: roll === 0 ? "LEAVE" : roll <= 2 ? "ABSENT" : roll === 3 ? "LATE" : "PRESENT",
            },
          },
          upsert: true,
        },
      });
    }
  }
  if (attendanceDocs.length) await Attendance.bulkWrite(attendanceDocs, { ordered: false });

  const teacherDates = weekdays("2026-08-03", "2026-08-14");
  for (const teacher of teachers) {
    for (const date of teacherDates) {
      const exists = await TeacherAttendance.findOne({ workspaceId, teacherId: teacher._id, date });
      if (!exists) {
        await TeacherAttendance.create({
          workspaceId,
          teacherId: teacher._id,
          date,
          status: date === "2026-08-04" && teacher.employeeId === "TCH-01" ? "LEAVE" : "PRESENT",
        });
      }
    }
  }

  let julyExam = await Exam.findOne({ workspaceId, name: "July Fun Assessment" });
  if (!julyExam) {
    julyExam = await Exam.create({
      workspaceId,
      name: "July Fun Assessment",
      academicSessionId: session._id,
      startDate: "2026-07-15",
      endDate: "2026-07-18",
      status: "COMPLETED",
    });
  } else if (!julyExam.academicSessionId) {
    julyExam.academicSessionId = session._id;
    await julyExam.save();
  }

  let augustExam = await Exam.findOne({ workspaceId, name: "August Oral Review" });
  if (!augustExam) {
    augustExam = await Exam.create({
      workspaceId,
      name: "August Oral Review",
      academicSessionId: session._id,
      startDate: "2026-08-20",
      endDate: "2026-08-22",
      status: "SCHEDULED",
    });
  }

  const oralSubjects = ["English", "Mathematics", "Rhymes"];
  for (const exam of [julyExam, augustExam]) {
    const start = exam === julyExam ? "2026-07-15" : "2026-08-20";
    for (const schoolClass of classes) {
      const classSubjects = subjects.filter((row) => String(row.classId) === String(schoolClass._id));
      for (const [index, subjectName] of oralSubjects.entries()) {
        const subject = classSubjects.find((row) => row.name === subjectName) ?? classSubjects[index];
        if (!subject) continue;
        const date = new Date(`${start}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const exists = await ExamSchedule.findOne({
          workspaceId,
          examId: exam._id,
          classId: schoolClass._id,
          subjectId: subject._id,
        });
        if (!exists) {
          await ExamSchedule.create({
            workspaceId,
            examId: exam._id,
            classId: schoolClass._id,
            subjectId: subject._id,
            date: date.toISOString().slice(0, 10),
            startTime: "09:30",
            endTime: "10:15",
            maxMarks: 50,
          });
        }
      }
    }
  }

  await Book.updateMany(
    { workspaceId, author: "GirjaSoft Demo Press" },
    { $set: { author: "Meena Rao" } },
  );
  const extraIssues = students.slice(2, 8);
  const books = await Book.find({ workspaceId });
  for (const [index, student] of extraIssues.entries()) {
    const book = books[index % books.length];
    if (!book) continue;
    const exists = await BookIssue.findOne({ workspaceId, bookId: book._id, studentId: student._id });
    if (!exists) {
      await BookIssue.create({
        workspaceId,
        bookId: book._id,
        studentId: student._id,
        issueDate: "2026-08-05",
        dueDate: "2026-08-19",
        status: "ISSUED",
      });
    }
  }

  const stock = [
    { name: "Notebook sets", sku: "DM-NB-01", quantity: 120, unit: "set", location: "Store" },
    { name: "Glue sticks", sku: "DM-GL-01", quantity: 60, unit: "pcs", location: "Store" },
    { name: "First-aid kit", sku: "DM-FA-01", quantity: 6, unit: "kit", location: "Office" },
    { name: "Soft balls", sku: "DM-SP-01", quantity: 18, unit: "pcs", location: "Play area" },
  ];
  for (const item of stock) {
    let record = await InventoryItem.findOne({ workspaceId, sku: item.sku });
    if (!record) record = await InventoryItem.create({ workspaceId, ...item });
    const exists = await InventoryTransaction.findOne({ workspaceId, itemId: record._id, type: "IN" });
    if (!exists) {
      await InventoryTransaction.create({
        workspaceId,
        itemId: record._id,
        type: "IN",
        quantity: item.quantity,
        date: "2026-07-20",
        notes: "Opening stock for 2026-2027",
      });
    }
  }
  const crayons = await InventoryItem.findOne({ workspaceId, sku: "DM-CRY-01" });
  if (crayons) {
    const out = await InventoryTransaction.findOne({ workspaceId, itemId: crayons._id, type: "OUT" });
    if (!out) {
      await InventoryTransaction.create({
        workspaceId,
        itemId: crayons._id,
        type: "OUT",
        quantity: 9,
        date: "2026-08-06",
        notes: "Issued to Pre-Nursery A, B and C",
      });
    }
  }

  const notices = [
    ["Independence Day celebration", "Students may come in tricolour dress. Programme starts at 9:00 AM.", "ALL", "2026-08-14"],
    ["August fee reminder", "Tuition for August is due by 10 August. Please collect the receipt from the office.", "PARENTS", "2026-08-05"],
    ["Staff meeting", "Academic coordination meeting in the staff room at 3:30 PM.", "STAFF", "2026-08-12"],
    ["Oral review timetable", "August Oral Review will be held from 20 to 22 August. Please check the exam schedule.", "STUDENTS", "2026-08-16"],
  ] as const;
  for (const [title, body, audience, date] of notices) {
    const exists = await Notice.findOne({ workspaceId, title });
    if (!exists) await Notice.create({ workspaceId, title, body, audience, date });
  }

  const noteExists = await Notification.findOne({ workspaceId, title: "Homework due tomorrow" });
  if (!noteExists) {
    await Notification.create({
      workspaceId,
      title: "Homework due tomorrow",
      body: "English tracing worksheets are due for all KG sections.",
      read: false,
    });
  }

  const docs = [
    { title: "Academic Calendar 2026-2027", category: "Academic", url: "/documents/academic-calendar-2026-2027.pdf" },
    { title: "Fee circular – August 2026", category: "Finance", url: "/documents/fee-circular-august-2026.pdf" },
    { title: "Transport route map", category: "Transport", url: "/documents/transport-routes.pdf" },
  ];
  for (const doc of docs) {
    const exists = await Document.findOne({ workspaceId, title: doc.title });
    if (!exists) await Document.create({ workspaceId, ...doc });
  }

  const firstByClass = new Map<string, typeof students[0]>();
  for (const student of students) {
    const key = String(student.classId);
    if (!firstByClass.has(key)) firstByClass.set(key, student);
  }
  for (const student of firstByClass.values()) {
    const email = `portal.${student.admissionNumber.toLowerCase()}@demo.girjasoft.in`;
    const exists = await User.findOne({ workspaceId, email });
    if (!exists) {
      await User.create({
        workspaceId,
        name: student.name,
        email,
        phone: student.phone,
        username: `student-${student.admissionNumber.toLowerCase()}`,
        passwordHash,
        department: "Academic",
        employeeId: `STU-${student.admissionNumber}`,
        roleIds: [await roleId("student")],
        linkedStudentId: student._id,
        linkedStudentIds: [student._id],
        status: "ACTIVE",
      });
    }
  }

  const homeworkCount = await Homework.countDocuments({ workspaceId });
  const timetableCount = await Timetable.countDocuments({ workspaceId });
  if (homeworkCount < 9 || timetableCount < 50) {
    console.log("Academic timetable/homework still thin; run npm run seed:dm01-academic if needed.");
  }

  const orphans = {
    studentsWithoutClass: await Student.countDocuments({ workspaceId, $or: [{ classId: null }, { classId: { $exists: false } }] }),
    studentsWithoutSection: await Student.countDocuments({ workspaceId, $or: [{ sectionId: null }, { sectionId: { $exists: false } }] }),
    studentsWithoutParent: await Student.countDocuments({ workspaceId, $or: [{ parentId: null }, { parentId: { $exists: false } }] }),
    placeholderStudents: await Student.countDocuments({ workspaceId, name: /^Student\d+$/ }),
  };

  const report = {
    workspace: WORKSPACE_CODE,
    classes: classes.length,
    sections: sections.length,
    students: students.length,
    parents: await Parent.countDocuments({ workspaceId }),
    teachers: teachers.length,
    staff: await Staff.countDocuments({ workspaceId }),
    subjects: subjects.length,
    attendance: await Attendance.countDocuments({ workspaceId }),
    teacherAttendance: await TeacherAttendance.countDocuments({ workspaceId }),
    timetable: timetableCount,
    homework: homeworkCount,
    exams: await Exam.countDocuments({ workspaceId }),
    examSchedules: await ExamSchedule.countDocuments({ workspaceId }),
    marks: await mongoose.connection.collection("marks").countDocuments({ workspaceId }),
    results: await mongoose.connection.collection("results").countDocuments({ workspaceId }),
    feeStructures: await FeeStructure.countDocuments({ workspaceId }),
    studentFees: await StudentFee.countDocuments({ workspaceId }),
    vehicles: await Vehicle.countDocuments({ workspaceId }),
    routes: await TransportRoute.countDocuments({ workspaceId }),
    transportAssignments: await TransportAssignment.countDocuments({ workspaceId }),
    leaveRequests: await LeaveRequest.countDocuments({ workspaceId }),
    salaryStructures: await SalaryStructure.countDocuments({ workspaceId }),
    payroll: await Payroll.countDocuments({ workspaceId }),
    inventory: await InventoryItem.countDocuments({ workspaceId }),
    inventoryTransactions: await InventoryTransaction.countDocuments({ workspaceId }),
    notices: await Notice.countDocuments({ workspaceId }),
    notifications: await Notification.countDocuments({ workspaceId }),
    documents: await Document.countDocuments({ workspaceId }),
    users: await User.countDocuments({ workspaceId }),
    orphans,
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
