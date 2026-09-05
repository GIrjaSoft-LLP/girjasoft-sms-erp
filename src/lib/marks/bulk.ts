import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { getExcelCell, normalizeClassName } from "@/lib/excel-academic";
import {
  assertMarksMutationAllowed,
  assertTeacherCanScore,
  teacherAllowedSubjectIds,
} from "@/lib/marks/access";
import { ratingForPercentage, roundMarks } from "@/lib/marks/grades";
import { examSubjects, getGradeCriteria, recalculateStudentResult } from "@/lib/marks/service";
import { resolveTeacherAssignmentScope } from "@/lib/teacher-scope";
import { Exam, Mark, SchoolClass, Section, Student } from "@/models/workspace";

const STUDENT_HEADERS = ["Admission Number", "Student Name", "Class Name", "Section"] as const;
const MAX_IMPORT_ROWS = 2000;

export type BulkSubjectColumn = { subjectId: string; name: string; maxMarks: number; classId: string };
export type BulkPreviewError = {
  excelRow: number;
  studentName: string;
  subjectName?: string;
  message: string;
};
export type BulkPreviewUpdate = {
  excelRow: number;
  studentName: string;
  subjectName: string;
  existingGained: number;
  newGained: number;
};
export type BulkImportSubject = {
  subjectId: string;
  maxMarks: number;
  marksObtained: number;
};
export type BulkImportStudent = {
  excelRow: number;
  studentId: string;
  classId: string;
  sectionId: string;
  studentName: string;
  subjects: BulkImportSubject[];
};

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseSubjectHeader(header: string): { name: string; kind: "total" | "gained" } | null {
  const value = header.trim().replace(/_+/g, " ").replace(/\s+/g, " ");
  const total = /^(.*)[\s]+total$/i.exec(value);
  if (total?.[1]) return { name: total[1].trim(), kind: "total" };
  const gained = /^(.*)[\s]+gained$/i.exec(value);
  if (gained?.[1]) return { name: gained[1].trim(), kind: "gained" };
  return null;
}

function parseMarksValue(raw: string, label: string): { empty: true } | { error: string } | { value: number } {
  if (raw === "") return { empty: true };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { error: `${label} must be a valid number.` };
  return { value };
}

async function loadExam(ctx: TenantContext, examId: string) {
  if (!mongoose.isValidObjectId(examId)) throw new ApiError(400, "Select a valid exam.");
  const exam = await Exam.findOne({ _id: examId, workspaceId: oid(ctx.workspaceId) })
    .select("name classId")
    .lean();
  if (!exam) throw new ApiError(404, "Exam not found.");
  return exam;
}

async function resolveBulkScope(ctx: TenantContext, examId: string, classId?: string, sectionId?: string) {
  assertMarksMutationAllowed(ctx);
  const exam = await loadExam(ctx, examId);
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  if (classId && !mongoose.isValidObjectId(classId)) throw new ApiError(400, "Select a valid class.");
  if (sectionId && !mongoose.isValidObjectId(sectionId)) throw new ApiError(400, "Select a valid section.");
  if (classId) await assertTeacherCanScore(ctx, { classId, sectionId });

  const classQuery: Record<string, unknown> = { workspaceId: oid(ctx.workspaceId), status: { $ne: "INACTIVE" } };
  if (exam.classId) classQuery._id = exam.classId;
  if (classId) classQuery._id = oid(classId);
  if (teacherScope.restricted) {
    const allowed = [...teacherScope.classIds].map((id) => oid(id));
    classQuery._id = classId ? oid(classId) : { $in: allowed };
  }
  const classes = await SchoolClass.find(classQuery).sort({ numericName: 1, name: 1 }).select("name").lean();
  if (!classes.length) throw new ApiError(400, "No classes are available for this exam.");

  const classIds = classes.map((row) => row._id);
  const sectionQuery: Record<string, unknown> = { workspaceId: oid(ctx.workspaceId), classId: { $in: classIds } };
  if (sectionId) sectionQuery._id = oid(sectionId);
  if (teacherScope.restricted) {
    sectionQuery._id = sectionId ? oid(sectionId) : { $in: [...teacherScope.sectionIds].map((id) => oid(id)) };
  }
  const sections = await Section.find(sectionQuery).sort({ name: 1 }).select("name classId").lean();

  const studentQuery: Record<string, unknown> = {
    workspaceId: oid(ctx.workspaceId),
    classId: { $in: classIds },
    status: { $ne: "INACTIVE" },
  };
  if (sections.length) studentQuery.sectionId = { $in: sections.map((row) => row._id) };
  if (sectionId) studentQuery.sectionId = oid(sectionId);
  const students = await Student.find(studentQuery)
    .sort({ name: 1 })
    .select("name admissionNumber classId sectionId")
    .lean();

  const subjectsByClass = new Map<string, BulkSubjectColumn[]>();
  const subjectColumns: BulkSubjectColumn[] = [];
  const seenNames = new Set<string>();
  for (const classDoc of classes) {
    const classKey = String(classDoc._id);
    let subjects = await examSubjects(ctx.workspaceId, examId, classKey);
    const allowed = await teacherAllowedSubjectIds(ctx, classKey, sectionId);
    if (allowed) subjects = subjects.filter((row) => allowed.has(row._id));
    const mapped = subjects.map((row) => ({
      subjectId: row._id,
      name: row.name,
      maxMarks: row.maxMarks,
      classId: classKey,
    }));
    subjectsByClass.set(classKey, mapped);
    for (const subject of mapped) {
      const key = normalizeName(subject.name);
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      subjectColumns.push(subject);
    }
  }

  return { exam, classes, sections, students, subjectColumns, subjectsByClass };
}

function subjectHeaders(subjectColumns: BulkSubjectColumn[]) {
  return subjectColumns.flatMap((subject) => [`${subject.name} Total`, `${subject.name} Gained`]);
}

export async function buildMarksTemplateBuffer(
  ctx: TenantContext,
  examId: string,
  classId?: string,
  sectionId?: string,
) {
  const { exam, students, classes, sections, subjectColumns, subjectsByClass } = await resolveBulkScope(
    ctx,
    examId,
    classId,
    sectionId,
  );
  if (!subjectColumns.length) throw new ApiError(400, "No subjects are available for this exam.");
  if (students.length > MAX_IMPORT_ROWS) {
    throw new ApiError(400, `Template is limited to ${MAX_IMPORT_ROWS} students. Select a class or section.`);
  }

  const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionMap = new Map(sections.map((row) => [String(row._id), row.name]));
  const headers = [...STUDENT_HEADERS, ...subjectHeaders(subjectColumns)];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GirjaSoft SMS ERP";
  const sheet = workbook.addWorksheet("Marks");
  const instruction = workbook.addWorksheet("Instructions");
  instruction.addRow(["Bulk Marks Upload"]);
  instruction.addRow([`Exam: ${exam.name}`]);
  instruction.addRow([]);
  [
    "1. Do not change column headers.",
    "2. Do not change Admission Number, Student Name, Class Name or Section for pre-filled students.",
    "3. Enter gained marks only. Total marks are pre-filled from the exam.",
    "4. Do not enter Percentage or Rating. The system calculates those.",
    "5. One student occupies one row.",
    "6. Gained marks cannot be greater than that subject's total marks.",
    "7. Save as .xlsx and upload from Marks → Bulk Upload.",
  ].forEach((line) => instruction.addRow([line]));
  instruction.getColumn(1).width = 90;

  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { wrapText: true, vertical: "middle" };

  headerRow.eachCell((cell, colNumber) => {
    const header = headers[colNumber - 1] ?? "";
    if (STUDENT_HEADERS.includes(header as (typeof STUDENT_HEADERS)[number])) {
      cell.note = "Do not change this value for pre-filled students.";
    } else if (/ total$/i.test(header)) {
      cell.note = "Maximum marks for this subject. Usually leave as generated.";
    } else if (/ gained$/i.test(header)) {
      cell.note = "Enter the marks obtained. Leave blank to skip this subject.";
    }
  });

  for (const student of students) {
    const classKey = String(student.classId ?? "");
    const classSubjects = subjectsByClass.get(classKey) ?? [];
    const byName = new Map(classSubjects.map((row) => [normalizeName(row.name), row]));
    const values: Array<string | number> = [
      student.admissionNumber ?? "",
      student.name,
      classMap.get(classKey) ?? "",
      sectionMap.get(String(student.sectionId ?? "")) ?? "",
    ];
    for (const column of subjectColumns) {
      const match = byName.get(normalizeName(column.name));
      values.push(match ? match.maxMarks : "");
      values.push("");
    }
    sheet.addRow(values);
  }

  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = header.length > 18 ? Math.min(header.length + 2, 28) : 18;
  });
  sheet.views = [{ state: "frozen", ySplit: 1, activeCell: "E2" }];
  if (students.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: students.length + 1, column: headers.length },
    };
  }

  const lastRow = Math.max(students.length + 1, 2) + 200;
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const prefilled = rowNumber > 1 && rowNumber <= students.length + 1;
    for (let col = 1; col <= headers.length; col += 1) {
      const header = headers[col - 1] ?? "";
      const isIdentity = col <= STUDENT_HEADERS.length;
      const isTotal = / total$/i.test(header);
      const locked = rowNumber === 1 || (prefilled && (isIdentity || isTotal));
      row.getCell(col).protection = { locked };
    }
  }
  await sheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    insertRows: true,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `marks-${exam.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-template.xlsx`,
  };
}

async function readMarksSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ApiError(400, "Could not read the file. Upload a valid .xlsx Excel workbook.");
  }
  const sheet = workbook.getWorksheet("Marks") ?? workbook.worksheets[0];
  if (!sheet) throw new ApiError(400, "The Excel file has no worksheet.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const raw = cell.value;
    const value =
      raw && typeof raw === "object" && "text" in raw
        ? String((raw as { text: string }).text)
        : String(raw ?? "").trim();
    headers[colNumber - 1] = value.trim();
  });

  const rows: Array<{ excelRow: number; values: Record<string, string> }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    let empty = true;
    headers.forEach((header, index) => {
      if (!header) return;
      const raw = row.getCell(index + 1).value;
      const value =
        raw && typeof raw === "object" && "text" in raw
          ? String((raw as { text: string }).text)
          : String(raw ?? "").trim();
      values[header] = value;
      if (value) empty = false;
    });
    if (!empty) rows.push({ excelRow: rowNumber, values });
  });
  return { headers: headers.filter(Boolean), rows };
}

type StudentLookup = {
  _id: string;
  name: string;
  admissionNumber: string;
  classId: string;
  sectionId: string;
};

async function buildStudentLookups(workspaceId: string) {
  const students = await Student.find({ workspaceId: oid(workspaceId), status: { $ne: "INACTIVE" } })
    .select("name admissionNumber classId sectionId")
    .lean();
  const byAdmission = new Map<string, StudentLookup>();
  const byNameClassSection = new Map<string, StudentLookup[]>();
  for (const student of students) {
    const item: StudentLookup = {
      _id: String(student._id),
      name: student.name,
      admissionNumber: String(student.admissionNumber ?? ""),
      classId: student.classId ? String(student.classId) : "",
      sectionId: student.sectionId ? String(student.sectionId) : "",
    };
    if (item.admissionNumber) byAdmission.set(normalizeName(item.admissionNumber), item);
    const key = `${normalizeName(item.name)}|${item.classId}|${item.sectionId}`;
    const list = byNameClassSection.get(key) ?? [];
    list.push(item);
    byNameClassSection.set(key, list);
  }
  return { byAdmission, byNameClassSection, students };
}

export async function validateMarksWorkbook(ctx: TenantContext, examId: string, buffer: Buffer) {
  assertMarksMutationAllowed(ctx);
  const exam = await loadExam(ctx, examId);
  const { headers, rows } = await readMarksSheet(buffer);
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(400, `Excel has more than ${MAX_IMPORT_ROWS} student rows. Split the file and upload again.`);
  }

  const missing = STUDENT_HEADERS.filter((header) => !headers.some((item) => normalizeName(item) === normalizeName(header)));
  if (missing.length) {
    throw new ApiError(400, `Missing required columns: ${missing.join(", ")}. Do not change the template headers.`);
  }

  const { classes, sections, subjectColumns, subjectsByClass } = await resolveBulkScope(ctx, examId);
  const classByName = new Map(classes.map((row) => [normalizeClassName(row.name), String(row._id)]));
  const classNameById = new Map(classes.map((row) => [String(row._id), row.name]));
  const sectionByKey = new Map(
    sections.map((row) => [`${String(row.classId)}|${normalizeName(row.name)}`, String(row._id)]),
  );
  const sectionNameById = new Map(sections.map((row) => [String(row._id), row.name]));
  const { byAdmission, byNameClassSection } = await buildStudentLookups(ctx.workspaceId);

  const knownSubjectNames = new Set(subjectColumns.map((row) => normalizeName(row.name)));
  const parsedColumns = headers
    .map((header) => ({ header, parsed: parseSubjectHeader(header) }))
    .filter((item): item is { header: string; parsed: { name: string; kind: "total" | "gained" } } => Boolean(item.parsed));
  const unknownSubjects = [...new Set(parsedColumns.map((item) => item.parsed.name))].filter(
    (name) => !knownSubjectNames.has(normalizeName(name)),
  );

  const errors: BulkPreviewError[] = [];
  const updates: BulkPreviewUpdate[] = [];
  const importRows: BulkImportStudent[] = [];
  const seenStudents = new Map<string, number>();

  if (unknownSubjects.length) {
    errors.push({
      excelRow: 1,
      studentName: "",
      message: `Unknown subject column(s) for this exam: ${unknownSubjects.join(", ")}.`,
    });
  }

  const existingMarks = await Mark.find({
    workspaceId: oid(ctx.workspaceId),
    examId: oid(examId),
  })
    .select("studentId subjectId marksObtained maxMarks")
    .lean();
  const existingMap = new Map(
    existingMarks.map((row) => [`${row.studentId}:${row.subjectId}`, Number(row.marksObtained)]),
  );
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  const allowedCache = new Map<string, Set<string> | null>();

  async function allowedFor(classId: string, sectionId?: string) {
    const key = `${classId}:${sectionId ?? ""}`;
    if (!allowedCache.has(key)) {
      allowedCache.set(key, await teacherAllowedSubjectIds(ctx, classId, sectionId));
    }
    return allowedCache.get(key) ?? null;
  }

  for (const row of rows) {
    const values = row.values;
    const admission = getExcelCell(values, "Admission Number", "Admission No.", "Admission No", "AdmissionNumber");
    const studentName = getExcelCell(values, "Student Name", "Student");
    const className = getExcelCell(values, "Class Name", "Class");
    const sectionName = getExcelCell(values, "Section", "Section Name");
    const rowErrors: BulkPreviewError[] = [];
    const pushError = (message: string, subjectName?: string) => {
      rowErrors.push({ excelRow: row.excelRow, studentName, subjectName, message });
    };

    if (!studentName) pushError("Student Name is required.");
    if (!className) pushError("Class Name is required.");
    if (!sectionName) pushError("Section is required.");

    const classId = classByName.get(normalizeClassName(className));
    if (className && !classId) pushError(`Class "${className}" is not part of this exam or workspace.`);
    const sectionId = classId ? sectionByKey.get(`${classId}|${normalizeName(sectionName)}`) : "";
    if (classId && sectionName && !sectionId) {
      pushError(`Section "${sectionName}" was not found for class "${className}".`);
    }

    if (teacherScope.restricted && classId) {
      if (!teacherScope.classIds.has(classId)) {
        pushError("You are not assigned to this class.");
      } else if (sectionId && !teacherScope.sectionIds.has(sectionId)) {
        pushError("You are not assigned to this section.");
      }
    }

    let student: StudentLookup | undefined;
    if (admission) {
      student = byAdmission.get(normalizeName(admission));
      if (!student) pushError(`Student with admission number "${admission}" was not found in this workspace.`);
    } else if (studentName && classId && sectionId) {
      const matches = byNameClassSection.get(`${normalizeName(studentName)}|${classId}|${sectionId}`) ?? [];
      if (!matches.length) pushError("Student not found for the given name, class and section.");
      else if (matches.length > 1) pushError("Multiple students match this name. Use Admission Number.");
      else student = matches[0];
    }

    if (student && classId && student.classId !== classId) {
      pushError(
        `Student does not belong to class "${className}". Current class is "${classNameById.get(student.classId) ?? ""}".`,
      );
    }
    if (student && sectionId && student.sectionId && student.sectionId !== sectionId) {
      pushError(
        `Student does not belong to section "${sectionName}". Current section is "${sectionNameById.get(student.sectionId) ?? ""}".`,
      );
    }

    if (student) {
      const previous = seenStudents.get(student._id);
      if (previous) pushError(`Duplicate student entry. Already listed on row ${previous}.`);
      else seenStudents.set(student._id, row.excelRow);
    }

    const classSubjects = classId ? (subjectsByClass.get(classId) ?? []) : [];
    const allowed = classId ? await allowedFor(classId, sectionId) : null;
    const subjectByName = new Map(classSubjects.map((item) => [normalizeName(item.name), item]));
    const subjects: BulkImportSubject[] = [];

    for (const column of subjectColumns) {
      const totalHeader = headers.find((header) => {
        const parsed = parseSubjectHeader(header);
        return parsed?.kind === "total" && normalizeName(parsed.name) === normalizeName(column.name);
      });
      const gainedHeader = headers.find((header) => {
        const parsed = parseSubjectHeader(header);
        return parsed?.kind === "gained" && normalizeName(parsed.name) === normalizeName(column.name);
      });
      const totalRaw = totalHeader ? String(values[totalHeader] ?? "").trim() : "";
      const gainedRaw = gainedHeader ? String(values[gainedHeader] ?? "").trim() : "";
      if (!totalRaw && !gainedRaw) continue;

      const classSubject = subjectByName.get(normalizeName(column.name));
      if (!classSubject) {
        if (gainedRaw) pushError(`Subject "${column.name}" is not part of this exam for ${className || "this class"}.`, column.name);
        continue;
      }
      if (allowed && !allowed.has(classSubject.subjectId)) {
        if (gainedRaw) pushError(`You are not assigned to subject "${column.name}".`, column.name);
        continue;
      }

      const totalParsed = parseMarksValue(totalRaw, `${column.name} Total`);
      const gainedParsed = parseMarksValue(gainedRaw, `${column.name} Gained`);
      if ("error" in totalParsed) {
        pushError(totalParsed.error, column.name);
        continue;
      }
      if ("error" in gainedParsed) {
        pushError(gainedParsed.error, column.name);
        continue;
      }
      if ("empty" in gainedParsed) continue;
      if ("empty" in totalParsed) {
        pushError(`${column.name} Total is required when gained marks are entered.`, column.name);
        continue;
      }
      if (!("value" in totalParsed) || !("value" in gainedParsed)) continue;
      const totalValue: number = totalParsed.value;
      const gainedValue: number = gainedParsed.value;
      if (totalValue <= 0) {
        pushError("Total marks must be greater than 0.", column.name);
        continue;
      }
      if (gainedValue < 0) {
        pushError("Gained marks cannot be negative.", column.name);
        continue;
      }
      if (gainedValue > totalValue) {
        pushError(
          `Gained Marks (${gainedValue}) cannot be greater than Total Marks (${totalValue}).`,
          column.name,
        );
        continue;
      }

      subjects.push({
        subjectId: classSubject.subjectId,
        maxMarks: totalValue,
        marksObtained: gainedValue,
      });
      if (student) {
        const existing = existingMap.get(`${student._id}:${classSubject.subjectId}`);
        if (existing != null && existing !== gainedValue) {
          updates.push({
            excelRow: row.excelRow,
            studentName,
            subjectName: column.name,
            existingGained: existing,
            newGained: gainedValue,
          });
        }
      }
    }

    if (!subjects.length && !rowErrors.length) {
      pushError("Enter gained marks for at least one subject.");
    }

    errors.push(...rowErrors);
    if (!rowErrors.length && student && classId && sectionId && subjects.length) {
      importRows.push({
        excelRow: row.excelRow,
        studentId: student._id,
        classId,
        sectionId,
        studentName: student.name,
        subjects,
      });
    }
  }

  return {
    examName: exam.name,
    totalRows: rows.length,
    validRows: importRows.length,
    invalidRows: rows.length - importRows.length,
    updateRows: updates.length,
    errors,
    updates,
    importRows,
    errorReport: formatErrorReport(exam.name, errors),
  };
}

function formatErrorReport(examName: string, errors: BulkPreviewError[]) {
  const lines = [`Bulk Marks Upload Errors`, `Exam: ${examName}`, ""];
  if (!errors.length) lines.push("No errors.");
  for (const error of errors) {
    lines.push(`Row ${error.excelRow}`);
    if (error.studentName) lines.push(`Student: ${error.studentName}`);
    if (error.subjectName) lines.push(`Subject: ${error.subjectName}`);
    lines.push(`Error: ${error.message}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function importValidatedMarks(
  ctx: TenantContext,
  examId: string,
  rows: BulkImportStudent[],
) {
  assertMarksMutationAllowed(ctx);
  await loadExam(ctx, examId);
  const preview = { errors: [] as BulkPreviewError[] };
  const criteria = await getGradeCriteria(ctx.workspaceId);
  const accepted: BulkImportStudent[] = [];
  const subjectsCache = new Map<string, Awaited<ReturnType<typeof examSubjects>>>();
  const allowedCache = new Map<string, Set<string> | null>();
  const students = await Student.find({
    workspaceId: oid(ctx.workspaceId),
    _id: { $in: rows.map((row) => oid(row.studentId)) },
  })
    .select("classId sectionId name")
    .lean();
  const studentMap = new Map(students.map((row) => [String(row._id), row]));

  for (const row of rows) {
    try {
      await assertTeacherCanScore(ctx, { classId: row.classId, sectionId: row.sectionId });
      const allowedKey = `${row.classId}:${row.sectionId}`;
      if (!allowedCache.has(allowedKey)) {
        allowedCache.set(allowedKey, await teacherAllowedSubjectIds(ctx, row.classId, row.sectionId));
      }
      const allowed = allowedCache.get(allowedKey) ?? null;
      if (!subjectsCache.has(row.classId)) {
        subjectsCache.set(row.classId, await examSubjects(ctx.workspaceId, examId, row.classId));
      }
      const classSubjects = subjectsCache.get(row.classId) ?? [];
      const allowedIds = new Set(classSubjects.map((item) => item._id));
      const student = studentMap.get(row.studentId);
      if (!student) throw new Error("Student not found.");
      if (String(student.classId) !== row.classId) throw new Error("Student does not belong to the selected class.");
      if (student.sectionId && String(student.sectionId) !== row.sectionId) {
        throw new Error("Student does not belong to the selected section.");
      }
      for (const subject of row.subjects) {
        if (!allowedIds.has(subject.subjectId)) throw new Error("A subject is not part of this exam.");
        if (allowed && !allowed.has(subject.subjectId)) throw new Error("You are not assigned to one or more subjects.");
        if (subject.marksObtained < 0 || subject.maxMarks <= 0 || subject.marksObtained > subject.maxMarks) {
          throw new Error("Invalid marks values.");
        }
      }
      accepted.push(row);
    } catch (error) {
      preview.errors.push({
        excelRow: row.excelRow,
        studentName: row.studentName,
        message: error instanceof Error ? error.message : "Row failed validation.",
      });
    }
  }

  const existing = await Mark.find({
    workspaceId: oid(ctx.workspaceId),
    examId: oid(examId),
    studentId: { $in: accepted.map((row) => oid(row.studentId)) },
  })
    .select("studentId subjectId")
    .lean();
  const existingKeys = new Set(existing.map((row) => `${row.studentId}:${row.subjectId}`));

  let created = 0;
  let updated = 0;
  const writes: Parameters<typeof Mark.bulkWrite>[0] = [];
  for (const row of accepted) {
    for (const subject of row.subjects) {
      const key = `${row.studentId}:${subject.subjectId}`;
      if (existingKeys.has(key)) updated += 1;
      else created += 1;
      const percent = roundMarks((subject.marksObtained / subject.maxMarks) * 100);
      writes.push({
        updateOne: {
          filter: {
            workspaceId: oid(ctx.workspaceId),
            examId: oid(examId),
            studentId: oid(row.studentId),
            subjectId: oid(subject.subjectId),
          },
          update: {
            $set: {
              workspaceId: oid(ctx.workspaceId),
              examId: oid(examId),
              studentId: oid(row.studentId),
              subjectId: oid(subject.subjectId),
              maxMarks: subject.maxMarks,
              marksObtained: subject.marksObtained,
              grade: ratingForPercentage(percent, criteria),
            },
          },
          upsert: true,
        },
      });
    }
  }

  const CHUNK = 250;
  try {
    if (writes.length) {
      for (let index = 0; index < writes.length; index += CHUNK) {
        await Mark.bulkWrite(writes.slice(index, index + CHUNK), { ordered: true });
      }
    }
    const studentIds = [...new Set(accepted.map((row) => row.studentId))];
    for (const studentId of studentIds) {
      await recalculateStudentResult(ctx, examId, studentId);
    }
  } catch (error) {
    throw new ApiError(
      500,
      `Import stopped because of a processing error: ${error instanceof Error ? error.message : "unknown error"}. Review Marks and retry the file.`,
    );
  }

  return {
    totalRows: rows.length,
    imported: accepted.length,
    created,
    updated,
    failed: preview.errors.length,
    errors: preview.errors,
    errorReport: formatErrorReport("Import", preview.errors),
  };
}
