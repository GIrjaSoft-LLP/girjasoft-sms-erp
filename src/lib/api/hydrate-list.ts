import mongoose from "mongoose";
import { User } from "@/models/identity";
import {
  Book,
  FeeStructure,
  InventoryItem,
  LeaveType,
  Parent,
  SchoolClass,
  Section,
  Staff,
  Student,
  StudentFee,
  Subject,
  Teacher,
  TransportRoute,
  Vehicle,
  Exam,
} from "@/models/workspace";

function refId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as { _id?: unknown };
    if (record._id) return String(record._id);
  }
  const text = String(value);
  return mongoose.isValidObjectId(text) ? text : "";
}

function collect(items: Record<string, unknown>[], key: string) {
  return [...new Set(items.map((item) => refId(item[key])).filter(Boolean))];
}

function asMap<T extends { _id: unknown }>(docs: T[]) {
  return new Map(docs.map((doc) => [String(doc._id), doc]));
}

export async function hydrateListItems(items: Record<string, unknown>[], resourceKey = "") {
  if (!items.length) return items;

  const studentIds = collect(items, "studentId");
  if (resourceKey === "parents") {
    for (const item of items) {
      const ids = Array.isArray(item.studentIds) ? item.studentIds : String(item.studentIds ?? "").split(/[\s,]+/);
      for (const id of ids) {
        const value = refId(id);
        if (value) studentIds.push(value);
      }
    }
  }
  const teacherIds = collect(items, "teacherId");
  if (resourceKey === "sections") {
    teacherIds.push(...collect(items, "classTeacherId"));
  }
  const staffIds = collect(items, "staffId");
  const subjectIds = collect(items, "subjectId");
  const examIds = collect(items, "examId");
  const bookIds = collect(items, "bookId");
  const studentFeeIds = collect(items, "studentFeeId");
  const leaveTypeIds = collect(items, "leaveTypeId");
  const routeIds = collect(items, "routeId");
  const vehicleIds = collect(items, "vehicleId");
  const inventoryIds = collect(items, "itemId");
  const classIds = collect(items, "classId");
  const sectionIds = collect(items, "sectionId");
  const feeStructureIds = collect(items, "feeStructureId");
  const parentIds = resourceKey === "students" ? collect(items, "parentId") : [];

  const [students, studentFees, parentUsers, teacherUsers, parentsForStudents] = await Promise.all([
    studentIds.length
      ? Student.find({ _id: { $in: studentIds } }).select("name admissionNumber classId sectionId").lean()
      : [],
    studentFeeIds.length
      ? StudentFee.find({ _id: { $in: studentFeeIds } }).select("feeStructureId").lean()
      : [],
    resourceKey === "parents"
      ? User.find({ linkedParentId: { $in: items.map((item) => item._id) } }).select(
          "username email status linkedParentId",
        ).lean()
      : [],
    resourceKey === "teachers"
      ? User.find({ linkedTeacherId: { $in: items.map((item) => item._id) } }).select(
          "username email status linkedTeacherId",
        ).lean()
      : [],
    resourceKey === "students" && parentIds.length
      ? Parent.find({ _id: { $in: parentIds } }).select("name phone").lean()
      : [],
  ]);

  for (const student of students) {
    const classId = refId(student.classId);
    const sectionId = refId(student.sectionId);
    if (classId) classIds.push(classId);
    if (sectionId) sectionIds.push(sectionId);
  }
  for (const fee of studentFees) {
    const headId = refId(fee.feeStructureId);
    if (headId) feeStructureIds.push(headId);
  }

  const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))];

  const [
    classes,
    sections,
    teachers,
    staff,
    subjects,
    exams,
    books,
    feeStructures,
    leaveTypes,
    routes,
    vehicles,
    inventory,
  ] = await Promise.all([
    unique(classIds).length ? SchoolClass.find({ _id: { $in: unique(classIds) } }).select("name").lean() : [],
    unique(sectionIds).length ? Section.find({ _id: { $in: unique(sectionIds) } }).select("name").lean() : [],
    teacherIds.length ? Teacher.find({ _id: { $in: teacherIds } }).select("name").lean() : [],
    staffIds.length ? Staff.find({ _id: { $in: staffIds } }).select("name").lean() : [],
    subjectIds.length ? Subject.find({ _id: { $in: subjectIds } }).select("name").lean() : [],
    examIds.length ? Exam.find({ _id: { $in: examIds } }).select("name").lean() : [],
    bookIds.length ? Book.find({ _id: { $in: bookIds } }).select("title").lean() : [],
    unique(feeStructureIds).length
      ? FeeStructure.find({ _id: { $in: unique(feeStructureIds) } }).select("name").lean()
      : [],
    leaveTypeIds.length ? LeaveType.find({ _id: { $in: leaveTypeIds } }).select("name").lean() : [],
    routeIds.length ? TransportRoute.find({ _id: { $in: routeIds } }).select("name").lean() : [],
    vehicleIds.length ? Vehicle.find({ _id: { $in: vehicleIds } }).select("number").lean() : [],
    inventoryIds.length ? InventoryItem.find({ _id: { $in: inventoryIds } }).select("name").lean() : [],
  ]);

  const studentMap = asMap(students);
  const classMap = asMap(classes);
  const sectionMap = asMap(sections);
  const teacherMap = asMap(teachers);
  const staffMap = asMap(staff);
  const subjectMap = asMap(subjects);
  const examMap = asMap(exams);
  const bookMap = asMap(books);
  const feeMap = asMap(feeStructures);
  const studentFeeMap = asMap(studentFees);
  const leaveMap = asMap(leaveTypes);
  const routeMap = asMap(routes);
  const vehicleMap = asMap(vehicles);
  const inventoryMap = asMap(inventory);
  const parentUserMap = new Map(
    parentUsers.map((user) => [String(user.linkedParentId), user]),
  );
  const teacherUserMap = new Map(
    teacherUsers.map((user) => [String(user.linkedTeacherId), user]),
  );
  const parentRecordMap = asMap(parentsForStudents);

  let sectionStudentCounts = new Map<string, number>();
  if (resourceKey === "sections" && items.length) {
    const workspaceId = refId(items[0].workspaceId);
    const sectionObjectIds = items
      .map((item) => refId(item._id))
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));
    if (workspaceId && sectionObjectIds.length) {
      const counts = await Student.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
            sectionId: { $in: sectionObjectIds },
          },
        },
        { $group: { _id: "$sectionId", count: { $sum: 1 } } },
      ]);
      sectionStudentCounts = new Map(counts.map((row) => [String(row._id), row.count]));
    }
  }

  return items.map((item) => {
    const student = studentMap.get(refId(item.studentId));
    const classDoc = classMap.get(refId(item.classId) || refId(student?.classId));
    const sectionDoc = sectionMap.get(refId(item.sectionId) || refId(student?.sectionId));
    const teacher = teacherMap.get(refId(item.teacherId));
    const staffDoc = staffMap.get(refId(item.staffId));
    const subject = subjectMap.get(refId(item.subjectId));
    const exam = examMap.get(refId(item.examId));
    const book = bookMap.get(refId(item.bookId));
    const linkedFee = studentFeeMap.get(refId(item.studentFeeId));
    const feeHead = feeMap.get(refId(item.feeStructureId) || refId(linkedFee?.feeStructureId));
    const leaveType = leaveMap.get(refId(item.leaveTypeId));
    const route = routeMap.get(refId(item.routeId));
    const vehicle = vehicleMap.get(refId(item.vehicleId));
    const inventoryItem = inventoryMap.get(refId(item.itemId));
    const parentUser = parentUserMap.get(String(item._id));
    const teacherUser = teacherUserMap.get(String(item._id));
    const linkedIds = Array.isArray(item.studentIds)
      ? item.studentIds
      : String(item.studentIds ?? "").split(/[\s,]+/);
    const linkedStudents = linkedIds
      .map((id) => studentMap.get(refId(id)))
      .filter(Boolean)
      .map((row) => `${row?.name ?? ""} (${row?.admissionNumber ?? ""})`)
      .join(", ");
    const parentRecord = parentRecordMap.get(refId(item.parentId));

    return {
      ...item,
      studentId: student ? String(student._id) : item.studentId ? String(item.studentId) : item.studentId,
      classId: classDoc ? String(classDoc._id) : student?.classId ? String(student.classId) : item.classId,
      sectionId: sectionDoc ? String(sectionDoc._id) : student?.sectionId ? String(student.sectionId) : item.sectionId,
      teacherId: teacher ? String(teacher._id) : item.teacherId,
      staffId: staffDoc ? String(staffDoc._id) : item.staffId,
      subjectId: subject ? String(subject._id) : item.subjectId,
      examId: exam ? String(exam._id) : item.examId,
      bookId: book ? String(book._id) : item.bookId,
      studentName: student?.name ?? "",
      admissionNumber: student?.admissionNumber ?? item.admissionNumber ?? "",
      className: classDoc?.name ?? "",
      sectionName: sectionDoc?.name ?? "",
      teacherName: teacher?.name ?? staffDoc?.name ?? "",
      subjectName: subject?.name ?? "",
      examName: exam?.name ?? "",
      bookTitle: book?.title ?? "",
      feeHead: feeHead?.name ?? "",
      leaveTypeName: leaveType?.name ?? "",
      routeName: route?.name ?? "",
      vehicleNumber: vehicle?.number ?? "",
      itemName: inventoryItem?.name ?? "",
      ...(resourceKey === "students"
        ? {
            studentCode: String(item.admissionNumber ?? ""),
            parentName: parentRecord?.name ?? "",
            parentMobile: parentRecord?.phone ?? "",
          }
        : {}),
      ...(resourceKey === "sections"
        ? (() => {
            const enrolled = sectionStudentCounts.get(String(item._id)) ?? 0;
            const capacity = Number(item.capacity ?? 0);
            const classTeacher = teacherMap.get(refId(item.classTeacherId));
            return {
              classOrder: item.classOrder ?? "",
              studentCount: enrolled,
              availableSeats: Math.max(0, capacity - enrolled),
              classTeacherName: classTeacher?.name ?? "",
            };
          })()
        : {}),
      ...(resourceKey === "parents"
        ? {
            linkedStudents,
            username: parentUser?.username || parentUser?.email || "",
            loginStatus: parentUser ? parentUser.status : "NO LOGIN",
            studentIds: Array.isArray(item.studentIds)
              ? item.studentIds.map((id) => String(id)).join(",")
              : String(item.studentIds ?? ""),
          }
        : {}),
      ...(resourceKey === "teachers"
        ? {
            username: teacherUser?.username || teacherUser?.email || "",
            loginStatus: teacherUser ? teacherUser.status : "NO LOGIN",
          }
        : {}),
      ...(resourceKey === "staff"
        ? {
            staffType:
              String(item.staffType ?? "").trim() ||
              (item.linkedTeacherId ? "Teacher" : ""),
          }
        : {}),
    };
  });
}
