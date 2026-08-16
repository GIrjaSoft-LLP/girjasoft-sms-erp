import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { Workspace } from "../src/models/platform";
import {
  Book,
  BookIssue,
  FeePayment,
  FeeStructure,
  SchoolClass,
  Section,
  Student,
  StudentFee,
} from "../src/models/workspace";

const WORKSPACE_CODE = "GIRJSOFT-DM-01";
const METHODS = ["CASH", "UPI", "BANK", "CARD"] as const;

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

async function nextReceipt(workspaceId: mongoose.Types.ObjectId) {
  const latest = await FeePayment.find({ workspaceId, receiptNumber: /^REC-DM-/ })
    .select("receiptNumber")
    .sort({ receiptNumber: -1 })
    .limit(200)
    .lean();
  let max = 0;
  for (const row of latest) {
    const match = String(row.receiptNumber).match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

async function main() {
  loadLocalEnv();
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB ?? "girjasoft_sms_erp",
  });
  const workspace = await Workspace.findOne({ code: WORKSPACE_CODE });
  if (!workspace) throw new Error("Workspace GIRJSOFT-DM-01 was not found.");
  const workspaceId = workspace._id;

  const paidFees = await StudentFee.find({ workspaceId, paidAmount: { $gt: 0 } });
  let receiptNo = await nextReceipt(workspaceId);
  let paymentsCreated = 0;
  for (const fee of paidFees) {
    const existing = await FeePayment.findOne({ workspaceId, studentFeeId: fee._id });
    if (existing) continue;
    const head = fee.feeStructureId
      ? await FeeStructure.findById(fee.feeStructureId).select("name")
      : null;
    const label = head?.name ?? "School fee";
    await FeePayment.create({
      workspaceId,
      studentId: fee.studentId,
      studentFeeId: fee._id,
      amount: fee.paidAmount,
      method: METHODS[receiptNo % METHODS.length],
      receiptNumber: `REC-DM-${String(receiptNo).padStart(4, "0")}`,
      date: fee.status === "PARTIAL" ? "2026-08-08" : fee.dueDate || "2026-08-05",
      remarks: `${label} received`,
    });
    receiptNo += 1;
    paymentsCreated += 1;
  }

  const classes = await SchoolClass.find({ workspaceId }).sort({ numericName: 1 });
  const sections = await Section.find({ workspaceId }).sort({ name: 1 });
  const books = await Book.find({ workspaceId }).sort({ title: 1 });
  const students = await Student.find({ workspaceId }).sort({ admissionNumber: 1 });
  let issuesCreated = 0;

  for (const [classIndex, schoolClass] of classes.entries()) {
    const classSections = sections.filter((row) => String(row.classId) === String(schoolClass._id));
    const classBooks = books.filter((_, index) => index % classes.length === classIndex);
    const usableBooks = classBooks.length ? classBooks : books;
    for (const [sectionIndex, section] of classSections.entries()) {
      const sectionStudents = students.filter((row) => String(row.sectionId) === String(section._id));
      const issuedBook = usableBooks[sectionIndex % usableBooks.length];
      const returnedBook = usableBooks[(sectionIndex + 1) % usableBooks.length];
      const issuedStudent = sectionStudents[0];
      const returnedStudent = sectionStudents[1];
      if (issuedBook && issuedStudent) {
        const exists = await BookIssue.findOne({
          workspaceId,
          bookId: issuedBook._id,
          studentId: issuedStudent._id,
          status: "ISSUED",
        });
        if (!exists) {
          await BookIssue.create({
            workspaceId,
            bookId: issuedBook._id,
            studentId: issuedStudent._id,
            issueDate: "2026-08-06",
            dueDate: "2026-08-20",
            returnDate: "",
            status: "ISSUED",
          });
          issuesCreated += 1;
        }
      }
      if (returnedBook && returnedStudent) {
        const exists = await BookIssue.findOne({
          workspaceId,
          bookId: returnedBook._id,
          studentId: returnedStudent._id,
        });
        if (!exists) {
          await BookIssue.create({
            workspaceId,
            bookId: returnedBook._id,
            studentId: returnedStudent._id,
            issueDate: "2026-07-18",
            dueDate: "2026-08-01",
            returnDate: "2026-07-30",
            status: "RETURNED",
          });
          issuesCreated += 1;
        }
      }
    }
  }

  for (const book of books) {
    const issued = await BookIssue.countDocuments({ workspaceId, bookId: book._id, status: "ISSUED" });
    const copies = book.copies || 10;
    book.available = Math.max(0, copies - issued);
    await book.save();
  }

  console.log(
    JSON.stringify(
      {
        workspace: WORKSPACE_CODE,
        paymentsCreated,
        payments: await FeePayment.countDocuments({ workspaceId }),
        paidFees: paidFees.length,
        issuesCreated,
        bookIssues: await BookIssue.countDocuments({ workspaceId }),
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
