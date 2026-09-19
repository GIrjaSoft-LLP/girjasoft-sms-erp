import mongoose from "mongoose";
import { STUDENT_EXCEL_HEADERS, STUDENT_EXCEL_SAMPLE, type StudentExcelHeader } from "@/config/excel";
import { STUDENT_MASTER_STATUSES } from "@/config/promotion";
import {
  buildClassLookupMap,
  getExcelCell,
  normalizeClassName,
} from "@/lib/excel-academic";
import { createInitialEnrollment, getCurrentAcademicSession } from "@/lib/enrollment/service";
import { ensureParentLogin, syncParentStudents } from "@/lib/parent-account";
import { assertSectionHasSeat } from "@/lib/sections";
import {
  AcademicSession,
  Parent,
  SchoolClass,
  Section,
  Student,
  StudentEnrollment,
} from "@/models/workspace";

export function studentExcelHeaders() {
  return [...STUDENT_EXCEL_HEADERS];
}

export function studentExcelSampleRow(): Record<string, unknown> {
  return { ...STUDENT_EXCEL_SAMPLE };
}

function asExcelRow(values: Record<StudentExcelHeader, string>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const header of STUDENT_EXCEL_HEADERS) {
    row[header] = values[header] ?? "";
  }
  return row;
}

function refId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "ACTIVE";
  const match = STUDENT_MASTER_STATUSES.find((status) => status.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

type ParentLookup = {
  _id: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  phone?: string;
  email?: string;
  created?: boolean;
};

type StudentImportLookups = {
  classes: Awaited<ReturnType<typeof buildClassLookupMap>>;
  sectionsByClassName: Map<string, { _id: mongoose.Types.ObjectId; name: string; classId: string }>;
  sessionsByName: Map<string, { _id: mongoose.Types.ObjectId; name: string }>;
  parentsByPhone: Map<string, ParentLookup>;
  parentsByEmail: Map<string, ParentLookup>;
  currentSessionId: string;
};

function rememberParent(
  lookups: StudentImportLookups,
  parent: { _id: unknown; phone?: string; email?: string; studentIds?: unknown[]; created?: boolean },
) {
  const entry: ParentLookup = {
    _id: parent._id as mongoose.Types.ObjectId,
    studentIds: (parent.studentIds ?? []).map((id) => new mongoose.Types.ObjectId(String(id))),
    phone: parent.phone ?? "",
    email: parent.email ?? "",
    created: parent.created,
  };
  const phone = normalizePhone(parent.phone ?? "");
  const email = normalizeEmail(parent.email ?? "");
  if (phone) lookups.parentsByPhone.set(phone, entry);
  if (email) lookups.parentsByEmail.set(email, entry);
}

export async function buildStudentImportLookups(workspaceId: string): Promise<StudentImportLookups> {
  const [classes, sections, sessions, parents, currentSession] = await Promise.all([
    buildClassLookupMap(workspaceId),
    Section.find({ workspaceId }).select("name classId").lean(),
    AcademicSession.find({ workspaceId }).select("name").lean(),
    Parent.find({ workspaceId }).select("phone email studentIds").lean(),
    getCurrentAcademicSession(workspaceId),
  ]);

  const sectionsByClassName = new Map<string, { _id: mongoose.Types.ObjectId; name: string; classId: string }>();
  for (const section of sections) {
    const classId = String(section.classId);
    sectionsByClassName.set(
      `${classId}::${normalizeClassName(section.name)}`,
      {
        _id: section._id as mongoose.Types.ObjectId,
        name: section.name,
        classId,
      },
    );
  }

  const sessionsByName = new Map<string, { _id: mongoose.Types.ObjectId; name: string }>();
  for (const session of sessions) {
    sessionsByName.set(normalizeClassName(session.name), {
      _id: session._id as mongoose.Types.ObjectId,
      name: session.name,
    });
  }

  const lookups: StudentImportLookups = {
    classes,
    sectionsByClassName,
    sessionsByName,
    parentsByPhone: new Map(),
    parentsByEmail: new Map(),
    currentSessionId: currentSession?._id ? String(currentSession._id) : "",
  };
  for (const parent of parents) {
    rememberParent(lookups, parent);
  }
  return lookups;
}

function objectIds(ids: string[]) {
  return ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
}

export async function exportStudentExcelRows(query: Record<string, unknown>) {
  const students = await Student.find(query).sort({ admissionNumber: 1 }).limit(10000).lean();
  if (!students.length) return [];

  const classIds = [...new Set(students.map((row) => refId(row.classId)).filter(Boolean))];
  const sectionIds = [...new Set(students.map((row) => refId(row.sectionId)).filter(Boolean))];
  const parentIds = [...new Set(students.map((row) => refId(row.parentId)).filter(Boolean))];
  const sessionIds = [...new Set(students.map((row) => refId(row.academicSessionId)).filter(Boolean))];
  const studentIds = students.map((row) => row._id);

  const [classes, sections, parents, sessions, enrollments] = await Promise.all([
    classIds.length ? SchoolClass.find({ _id: { $in: objectIds(classIds) } }).select("name").lean() : [],
    sectionIds.length ? Section.find({ _id: { $in: objectIds(sectionIds) } }).select("name").lean() : [],
    parentIds.length
      ? Parent.find({ _id: { $in: objectIds(parentIds) } }).select("name relation phone email").lean()
      : [],
    sessionIds.length
      ? AcademicSession.find({ _id: { $in: objectIds(sessionIds) } }).select("name").lean()
      : [],
    StudentEnrollment.find({
      studentId: { $in: studentIds },
      isCurrent: true,
    })
      .select("studentId classId sectionId academicSessionId rollNumber")
      .lean(),
  ]);

  const extraClassIds = [
    ...new Set(enrollments.map((row) => refId(row.classId)).filter((id) => id && !classIds.includes(id))),
  ];
  const extraSectionIds = [
    ...new Set(enrollments.map((row) => refId(row.sectionId)).filter((id) => id && !sectionIds.includes(id))),
  ];
  const extraSessionIds = [
    ...new Set(
      enrollments.map((row) => refId(row.academicSessionId)).filter((id) => id && !sessionIds.includes(id)),
    ),
  ];

  const [extraClasses, extraSections, extraSessions] = await Promise.all([
    extraClassIds.length ? SchoolClass.find({ _id: { $in: objectIds(extraClassIds) } }).select("name").lean() : [],
    extraSectionIds.length ? Section.find({ _id: { $in: objectIds(extraSectionIds) } }).select("name").lean() : [],
    extraSessionIds.length
      ? AcademicSession.find({ _id: { $in: objectIds(extraSessionIds) } }).select("name").lean()
      : [],
  ]);

  const classMap = new Map<string, string>(
    [...classes, ...extraClasses].map((row) => [String(row._id), row.name]),
  );
  const sectionMap = new Map(
    [...sections, ...extraSections].map((row) => [String(row._id), row.name]),
  );
  const parentMap = new Map(parents.map((row) => [String(row._id), row]));
  const sessionMap = new Map(
    [...sessions, ...extraSessions].map((row) => [String(row._id), row.name]),
  );
  const enrollmentMap = new Map(enrollments.map((row) => [String(row.studentId), row]));

  return students.map((student) => {
    const enrollment = enrollmentMap.get(String(student._id));
    const classId = refId(enrollment?.classId) || refId(student.classId);
    const sectionId = refId(enrollment?.sectionId) || refId(student.sectionId);
    const sessionId = refId(enrollment?.academicSessionId) || refId(student.academicSessionId);
    const parent = parentMap.get(refId(student.parentId));
    return asExcelRow({
      "Admission No": student.admissionNumber ?? "",
      "Student Name": student.name ?? "",
      Class: classMap.get(classId) ?? "",
      Section: sectionMap.get(sectionId) ?? "",
      "Date Of Birth": student.dateOfBirth ?? "",
      Gender: student.gender ?? "",
      "Parent Name": parent?.name ?? "",
      Relation: parent?.relation ?? "",
      "Parent Mobile": parent?.phone ?? "",
      "Parent Email ID": parent?.email ?? "",
      Status: student.status ?? "",
      Address: student.address ?? "",
      "Academic Session": sessionMap.get(sessionId) ?? "",
      "Current Roll No": enrollment?.rollNumber ?? "",
    });
  });
}

async function resolveParent(
  workspaceId: string,
  lookups: StudentImportLookups,
  input: { name: string; relation: string; phone: string; email: string; address: string },
) {
  if (!input.name && !input.phone && !input.email && !input.relation) return null;
  if (!input.name && !input.phone && !input.email) return null;

  const existing =
    (input.phone ? lookups.parentsByPhone.get(normalizePhone(input.phone)) : undefined) ??
    (input.email ? lookups.parentsByEmail.get(normalizeEmail(input.email)) : undefined);

  if (existing) return existing;
  if (!input.name) {
    throw new Error("Parent Name is required to create a parent record.");
  }

  const created = await Parent.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    name: input.name,
    relation: input.relation || "Guardian",
    phone: input.phone,
    email: input.email,
    address: input.address,
    status: "ACTIVE",
    studentIds: [],
  });
  rememberParent(lookups, {
    _id: created._id,
    phone: created.phone,
    email: created.email,
    studentIds: [],
    created: true,
  });
  return lookups.parentsByPhone.get(normalizePhone(input.phone))
    ?? lookups.parentsByEmail.get(normalizeEmail(input.email))
    ?? {
      _id: created._id as mongoose.Types.ObjectId,
      studentIds: [] as mongoose.Types.ObjectId[],
      phone: created.phone,
      email: created.email,
      created: true,
    };
}

export async function importStudentExcelRow(
  workspaceId: string,
  row: Record<string, string>,
  lookups: StudentImportLookups,
) {
  const admissionNumber = getExcelCell(row, "Admission No", "Admission No.", "Admission Number");
  const name = getExcelCell(row, "Student Name");
  if (!admissionNumber || !name) {
    throw new Error("Admission No and Student Name are required.");
  }

  const duplicate = await Student.findOne({ workspaceId, admissionNumber });
  if (duplicate) return { action: "skipped" as const };

  const className = getExcelCell(row, "Class");
  const sectionName = getExcelCell(row, "Section");
  const sessionName = getExcelCell(row, "Academic Session");
  const rollNumber = getExcelCell(row, "Current Roll No");
  const dateOfBirth = getExcelCell(row, "Date Of Birth");
  const gender = getExcelCell(row, "Gender");
  const status = normalizeStatus(getExcelCell(row, "Status"));
  const address = getExcelCell(row, "Address");
  const parentName = getExcelCell(row, "Parent Name");
  const relation = getExcelCell(row, "Relation");
  const parentMobile = getExcelCell(row, "Parent Mobile");
  const parentEmail = getExcelCell(row, "Parent Email ID");

  let classId: mongoose.Types.ObjectId | null = null;
  let sectionId: mongoose.Types.ObjectId | null = null;
  let academicSessionId: mongoose.Types.ObjectId | null = null;

  if (sectionName && !className) {
    throw new Error("Class is required when Section is provided.");
  }
  if (className) {
    const classRef = lookups.classes.byName.get(normalizeClassName(className));
    if (!classRef) {
      throw new Error(
        `Class "${className}" was not found in this Workspace. Please create the Class first or correct the Class Name in the import file.`,
      );
    }
    classId = classRef._id;
    if (sectionName) {
      const section = lookups.sectionsByClassName.get(`${String(classId)}::${normalizeClassName(sectionName)}`);
      if (!section) {
        throw new Error(
          `Section "${sectionName}" was not found for class "${className}". Please create the Section first or correct the Section Name.`,
        );
      }
      sectionId = section._id;
    }
  }

  if (sessionName) {
    const session = lookups.sessionsByName.get(normalizeClassName(sessionName));
    if (!session) {
      throw new Error(
        `Academic Session "${sessionName}" was not found in this Workspace. Please create the session first or correct the name.`,
      );
    }
    academicSessionId = session._id;
  } else if (classId && sectionId && lookups.currentSessionId) {
    academicSessionId = new mongoose.Types.ObjectId(lookups.currentSessionId);
  }

  if (rollNumber && (!classId || !sectionId)) {
    throw new Error("Current Roll No requires Class and Section.");
  }
  if (rollNumber && !academicSessionId) {
    throw new Error("Current Roll No requires Academic Session.");
  }
  if (sectionId) {
    await assertSectionHasSeat(workspaceId, sectionId);
  }

  const parent = await resolveParent(workspaceId, lookups, {
    name: parentName,
    relation,
    phone: parentMobile,
    email: parentEmail,
    address,
  });

  const student = await Student.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    admissionNumber,
    name,
    gender,
    dateOfBirth,
    classId,
    sectionId,
    parentId: parent?._id ?? null,
    phone: parentMobile,
    email: parentEmail,
    address,
    status,
    academicSessionId,
  });

  if (parent) {
    const linkedIds = [...parent.studentIds, student._id as mongoose.Types.ObjectId];
    await syncParentStudents(workspaceId, parent._id, linkedIds);
    parent.studentIds = linkedIds;
    rememberParent(lookups, {
      _id: parent._id,
      phone: parent.phone || parentMobile,
      email: parent.email || parentEmail,
      studentIds: linkedIds,
      created: parent.created,
    });
    if (parent.created) {
      const refreshed = await Parent.findById(parent._id);
      if (refreshed) {
        await ensureParentLogin({
          workspaceId,
          parent: refreshed,
          createPassword: true,
        });
      }
    }
  }

  if (classId && sectionId && academicSessionId) {
    await createInitialEnrollment({
      workspaceId,
      studentId: String(student._id),
      academicSessionId: String(academicSessionId),
      classId: String(classId),
      sectionId: String(sectionId),
      rollNumber,
    });
  }

  return { action: "created" as const };
}
