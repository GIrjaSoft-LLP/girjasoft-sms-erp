import mongoose from "mongoose";
import { flattenListItem, RESOURCE_POPULATE } from "@/config/list-view";
import { hydrateListItems } from "@/lib/api/hydrate-list";
import { RESOURCES, RESOURCE_KEYS } from "@/config/resources";
import { getResourceModel } from "@/lib/api/resource-models";
import { logWorkspace } from "@/lib/audit";
import {
  ApiError,
  applyRecordVisibility,
  assertSameWorkspace,
  json,
  requirePerm,
  requireModuleEnabled,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { stripClientWorkspaceId } from "@/lib/sanitize";
import { User } from "@/models/identity";
import { Book, Exam, Parent, SchoolClass, Section, Student, Subject, Teacher } from "@/models/workspace";
import { ensureParentLogin, parseObjectIds, syncParentStudents } from "@/lib/parent-account";
import { assertTeacherCreationAllowed, isTeacherStaff, normalizeStaffType, staffPortalLoginEnabled, syncStaffTeacherProfile } from "@/lib/staff-teacher-sync";
import { ensureTeacherLogin } from "@/lib/teacher-account";
import { attachProfilePhotoUrls, removeProfilePhoto } from "@/lib/profile-photo";
import { applySectionPayload, assertSectionHasSeat } from "@/lib/sections";
import { applySubjectPayload } from "@/lib/subjects";
import {
  applyFamilyHomeworkVisibility,
  assertHomeworkMutationAllowed,
  assertHomeworkVisibleToFamily,
  isHomeworkReadOnlyActor,
} from "@/lib/homework/access";
import { resolveHomeworkWeekRange } from "@/lib/homework/week-range";
import { assertMarksMutationAllowed } from "@/lib/marks/access";
import { assertResultsMutationAllowed } from "@/lib/results/access";
import { applyTeacherPayrollVisibility, assertTeacherHrConfigAllowed, isTeacherSelfService } from "@/lib/hr/access";
import { applyTeacherLeave } from "@/lib/hr/leave";
import { linkPayrollTeacher } from "@/lib/hr/payroll";
import { assertHomeworkCreateAllowed, assertHomeworkUpdateAllowed } from "@/lib/homework/service";
import { applyFamilyExamVisibility, resolveLinkedStudentClassScope } from "@/lib/exams/access";
import { applyNoticeAudienceToQuery, assertNoticeReadable } from "@/lib/notices/access";
import {
  applyTeacherScopeToQuery,
  assertTeacherRecordAllowed,
  assertTeacherScopeAllowed,
  assertTeacherWritePayload,
  resolveTeacherAssignmentScope,
} from "@/lib/teacher-scope";
import { applyAdminPaymentToFee } from "@/lib/fees/collect";

const PAYMENT_PROTECTED_FIELDS = [
  "verificationStatus",
  "source",
  "appliedToFee",
  "receiptFile",
  "submittedBy",
  "submittedByName",
  "submittedAt",
  "verifiedBy",
  "verifiedAt",
  "rejectionReason",
];

function stripPaymentProtectedFields(body: Record<string, unknown>) {
  for (const key of PAYMENT_PROTECTED_FIELDS) delete body[key];
}

const STUDENT_LINKED = new Set(["marks", "results", "fees", "payments", "bookIssues", "transportAssignments"]);

function objectIdParam(url: URL, key: string) {
  const value = url.searchParams.get(key);
  if (value && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

export function getResource(key: string) {
  if (!RESOURCE_KEYS.includes(key)) {
    throw new ApiError(404, "Unknown resource.");
  }
  const model = getResourceModel(key);
  if (!model) throw new ApiError(404, "Unknown resource.");
  return { ...RESOURCES[key], model };
}

export async function listResource(resourceKey: string, request: Request) {
  const ctx = await requireWorkspaceContext();
  const resource = getResource(resourceKey);
  requireModuleEnabled(ctx, resourceKey);
  requirePerm(ctx, `${resource.permission}.view`);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const clientWorkspace = url.searchParams.get("workspaceId");
  if (clientWorkspace && clientWorkspace !== ctx.workspaceId) {
    throw new ApiError(403, "Forbidden.");
  }

  const query: Record<string, unknown> = { ...scopedQuery(ctx.workspaceId) };
  const classId = objectIdParam(url, "classId");
  const sectionId = objectIdParam(url, "sectionId");
  const status = url.searchParams.get("status");
  const date = url.searchParams.get("date");
  const day = url.searchParams.get("day");
  if (status) {
    if (resourceKey === "payments") {
      if (status === "CONFIRMED") {
        query.verificationStatus = { $nin: ["PENDING_VERIFICATION", "REJECTED"] };
      } else {
        query.verificationStatus = status;
      }
    } else {
      query.status = status;
    }
  }
  if (date) query.date = date;
  if (day) query.day = day;

  if (STUDENT_LINKED.has(resourceKey) && (classId || sectionId)) {
    const studentQuery: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (classId) studentQuery.classId = classId;
    if (sectionId) studentQuery.sectionId = sectionId;
    const studentIds = await Student.find(studentQuery).distinct("_id");
    query.studentId = { $in: studentIds };
  } else {
    if (classId) query.classId = classId;
    if (sectionId) query.sectionId = sectionId;
  }

  if (q.trim()) {
    const term = q.trim();
    const clauses: Array<Record<string, unknown>> = resource.searchFields.map((field) => ({
      [field]: { $regex: term, $options: "i" },
    }));
    const re = { $regex: term, $options: "i" };
    const workspaceId = ctx.workspaceId;
    if (["attendance", "marks", "results", "fees", "payments", "bookIssues"].includes(resourceKey)) {
      const ids = await Student.find({
        workspaceId,
        $or: [{ name: re }, { admissionNumber: re }],
      }).distinct("_id");
      if (ids.length) clauses.push({ studentId: { $in: ids } });
    }
    if (["students", "sections", "subjects", "attendance", "timetable", "homework"].includes(resourceKey)) {
      const ids = await SchoolClass.find({ workspaceId, name: re }).distinct("_id");
      if (ids.length) clauses.push({ classId: { $in: ids } });
    }
    if (["students", "attendance", "timetable", "homework"].includes(resourceKey)) {
      const ids = await Section.find({ workspaceId, name: re }).distinct("_id");
      if (ids.length) clauses.push({ sectionId: { $in: ids } });
    }
    if (["timetable", "homework", "teacherAttendance"].includes(resourceKey)) {
      const ids = await Teacher.find({ workspaceId, name: re }).distinct("_id");
      if (ids.length) clauses.push({ teacherId: { $in: ids } });
    }
    if (["timetable", "homework", "marks"].includes(resourceKey)) {
      const ids = await Subject.find({ workspaceId, name: re }).distinct("_id");
      if (ids.length) clauses.push({ subjectId: { $in: ids } });
    }
    if (["marks", "results"].includes(resourceKey)) {
      const ids = await Exam.find({ workspaceId, name: re }).distinct("_id");
      if (ids.length) clauses.push({ examId: { $in: ids } });
    }
    if (resourceKey === "bookIssues") {
      const ids = await Book.find({ workspaceId, title: re }).distinct("_id");
      if (ids.length) clauses.push({ bookId: { $in: ids } });
    }
    if (clauses.length) query.$or = clauses;
  }

  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  if (classId) assertTeacherScopeAllowed(teacherScope, { classId: String(classId) });
  if (sectionId) assertTeacherScopeAllowed(teacherScope, { sectionId: String(sectionId) });

  const visible = applyRecordVisibility(ctx, resourceKey, query);
  await applyFamilyExamVisibility(ctx, resourceKey, visible);
  await applyFamilyHomeworkVisibility(ctx, resourceKey, visible);
  applyNoticeAudienceToQuery(ctx, resourceKey, visible);
  await applyTeacherScopeToQuery(ctx, resourceKey, visible, teacherScope);
  if (resourceKey === "payroll") await applyTeacherPayrollVisibility(ctx, visible);

  let weekRange: { startDate: string; endDate: string } | null = null;
  if (resourceKey === "homework") {
    const familyViewer = isHomeworkReadOnlyActor(ctx);
    const requestedStart = url.searchParams.get("startDate");
    const requestedEnd = url.searchParams.get("endDate");
    if (familyViewer || (requestedStart && requestedEnd)) {
      weekRange = resolveHomeworkWeekRange(requestedStart, requestedEnd);
      visible.dueDate = { $gte: weekRange.startDate, $lte: weekRange.endDate };
    }
  }

  let finder = resource.model
    .find(visible)
    .sort(resourceKey === "homework" && weekRange ? { dueDate: 1, createdAt: 1 } : { createdAt: -1 })
    .limit(resourceKey === "homework" && weekRange ? 200 : 1000);
  const populate = RESOURCE_POPULATE[resourceKey] ?? [];
  for (const spec of populate) {
    finder = finder.populate(spec as never);
  }
  const items = await finder.lean();
  const flattened = (items as Record<string, unknown>[]).map((item) => flattenListItem(item));
  let hydrated = await hydrateListItems(flattened, resourceKey);
  if (resourceKey === "students" || resourceKey === "teachers") {
    hydrated = await attachProfilePhotoUrls(ctx.workspaceId, resourceKey, hydrated);
  }
  return json({
    items: hydrated,
    ...(weekRange ? weekRange : {}),
  });
}

export async function createResource(resourceKey: string, request: Request) {
  const ctx = await requireWorkspaceContext();
  const resource = getResource(resourceKey);
  requireModuleEnabled(ctx, resourceKey);
  const collect = resourceKey === "payments";
  requirePerm(ctx, collect ? `${resource.permission}.create` : `${resource.permission}.create`);
  if (collect) {
    requirePerm(ctx, "fees.collect");
  }
  const body = stripClientWorkspaceId(await request.json()) as Record<string, unknown>;
  if (resourceKey === "payments") {
    stripPaymentProtectedFields(body);
    body.verificationStatus = "CONFIRMED";
    body.source = "ADMIN";
    body.appliedToFee = false;
  }
  if (resourceKey === "parents") {
    const studentIds = parseObjectIds(body.studentIds);
    const created = await Parent.create({
      ...body,
      studentIds,
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    });
    const linked = await syncParentStudents(ctx.workspaceId, created._id as mongoose.Types.ObjectId, studentIds);
    created.studentIds = linked;
    await created.save();
    const { user, temporaryPassword } = await ensureParentLogin({
      workspaceId: ctx.workspaceId,
      parent: created,
      createPassword: true,
    });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.create`, resourceKey, String(created._id));
    return json(
      {
        item: created,
        login: user
          ? {
              username: user.username,
              email: user.email,
              temporaryPassword,
              role: "Parent",
            }
          : null,
      },
      201,
    );
  }
  if (resourceKey === "teachers") {
    await assertTeacherCreationAllowed();
  }
  if (resourceKey === "staff") {
    const staffType = normalizeStaffType(body);
    const isTeacher = isTeacherStaff({ staffType, designation: String(body.designation ?? "") });
    const created = await resource.model.create({
      ...body,
      staffType,
      enablePortalLogin: staffPortalLoginEnabled(body, isTeacher),
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    });
    const staffDoc = created as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      email?: string;
      phone?: string;
      department?: string;
      designation?: string;
      employeeId?: string;
      qualification?: string;
      experience?: string;
      joiningDate?: string;
      status?: string;
      staffType?: string;
      linkedTeacherId?: mongoose.Types.ObjectId;
      enablePortalLogin?: boolean;
    };
    const { login } = await syncStaffTeacherProfile(ctx.workspaceId, staffDoc, { createPassword: true });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.create`, resourceKey, String(created._id));
    return json({ item: created, login }, 201);
  }
  if (resourceKey === "sections") {
    await applySectionPayload(ctx.workspaceId, body);
    const created = await resource.model.create({
      ...body,
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.create`, resourceKey, String(created._id));
    return json({ item: created }, 201);
  }
  if (resourceKey === "subjects") {
    await applySubjectPayload(ctx.workspaceId, body);
    const created = await resource.model.create({
      ...body,
      workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.create`, resourceKey, String(created._id));
    return json({ item: created }, 201);
  }
  if (resourceKey === "students" && body.sectionId) {
    await assertSectionHasSeat(ctx.workspaceId, body.sectionId);
  }
  if (resourceKey === "homework") {
    await assertHomeworkCreateAllowed(ctx, body);
  }
  if (resourceKey === "marks") {
    assertMarksMutationAllowed(ctx);
  }
  if (resourceKey === "results") {
    assertResultsMutationAllowed(ctx);
  }
  if (resourceKey === "leaveTypes") {
    assertTeacherHrConfigAllowed(ctx);
  }
  if (resourceKey === "leave" && isTeacherSelfService(ctx)) {
    const created = await applyTeacherLeave(ctx, body);
    await logWorkspace(ctx.session, ctx.workspaceId, "leave.create", "leave", String(created.item._id));
    return json(created, 201);
  }
  if (resourceKey === "payroll") {
    assertTeacherHrConfigAllowed(ctx);
    if (!body.status) body.status = "DRAFT";
    await linkPayrollTeacher(ctx.workspaceId, body);
  }
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherWritePayload(ctx, teacherScope, resourceKey, body);
  const created = await resource.model.create({
    ...body,
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
  });
  if (resourceKey === "payments") {
    await applyAdminPaymentToFee(ctx.workspaceId, String(created._id), body.studentFeeId);
  }
  await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.create`, resourceKey, String(created._id));
  return json({ item: created }, 201);
}

type TenantDoc = { _id: unknown; workspaceId: unknown };

export async function getResourceById(resourceKey: string, id: string) {
  const ctx = await requireWorkspaceContext();
  const resource = getResource(resourceKey);
  requireModuleEnabled(ctx, resourceKey);
  requirePerm(ctx, `${resource.permission}.view`);
  const item = (await resource.model.findById(id).lean()) as unknown as TenantDoc | null;
  if (!item) throw new ApiError(404, "Record not found.");
  assertSameWorkspace(item.workspaceId, ctx.workspaceId);
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherRecordAllowed(ctx, teacherScope, resourceKey, item as Record<string, unknown>);
  if (resourceKey === "notices") {
    assertNoticeReadable(ctx, item as { audience?: string | null });
  }
  if (resourceKey === "homework") {
    await assertHomeworkVisibleToFamily(ctx, item as { classId?: unknown; sectionId?: unknown });
  }
  if (resourceKey === "exams" || resourceKey === "examSchedules") {
    const familyScope = await resolveLinkedStudentClassScope(ctx);
    if (familyScope) {
      const recordClassId = String((item as Record<string, unknown>).classId ?? "");
      if (recordClassId && recordClassId !== familyScope.classId) {
        throw new ApiError(403, "Forbidden.");
      }
    }
  }
  const visible = applyRecordVisibility(ctx, resourceKey, scopedQuery(ctx.workspaceId, { _id: item._id }));
  await applyFamilyExamVisibility(ctx, resourceKey, visible);
  await applyFamilyHomeworkVisibility(ctx, resourceKey, visible);
  applyNoticeAudienceToQuery(ctx, resourceKey, visible);
  await applyTeacherScopeToQuery(ctx, resourceKey, visible, teacherScope);
  if (resourceKey === "payroll") await applyTeacherPayrollVisibility(ctx, visible);
  const allowed = await resource.model.findOne(visible).lean();
  if (!allowed) throw new ApiError(403, "Forbidden.");
  const [hydrated] = await hydrateListItems([allowed as Record<string, unknown>], resourceKey);
  return json({ item: hydrated ?? allowed });
}

export async function updateResource(resourceKey: string, id: string, request: Request) {
  const ctx = await requireWorkspaceContext();
  const resource = getResource(resourceKey);
  requireModuleEnabled(ctx, resourceKey);
  requirePerm(ctx, `${resource.permission}.edit`);
  const existing = await resource.model.findById(id);
  if (!existing) throw new ApiError(404, "Record not found.");
  const current = existing as unknown as TenantDoc & { save: () => Promise<unknown>; toObject: () => Record<string, unknown> };
  assertSameWorkspace(current.workspaceId, ctx.workspaceId);
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherRecordAllowed(ctx, teacherScope, resourceKey, current.toObject());
  const body = stripClientWorkspaceId(await request.json()) as Record<string, unknown>;
  if (resourceKey === "payments") {
    stripPaymentProtectedFields(body);
  }
  if (resourceKey === "homework") {
    assertHomeworkMutationAllowed(ctx);
    await assertHomeworkUpdateAllowed(ctx, current.toObject(), body);
  }
  if (resourceKey === "marks") {
    assertMarksMutationAllowed(ctx);
  }
  if (resourceKey === "results") {
    assertResultsMutationAllowed(ctx);
  }
  if (resourceKey === "leaveTypes" || resourceKey === "payroll") {
    assertTeacherHrConfigAllowed(ctx);
  }
  if (resourceKey === "payroll") {
    await linkPayrollTeacher(ctx.workspaceId, body);
  }
  if (resourceKey === "leave" && isTeacherSelfService(ctx)) {
    body.status = current.toObject().status === "PENDING" ? "PENDING" : current.toObject().status;
    delete body.teacherId;
  }
  await assertTeacherWritePayload(ctx, teacherScope, resourceKey, body);
  if (resourceKey === "parents" && "studentIds" in body) {
    body.studentIds = parseObjectIds(body.studentIds);
  }
  if (resourceKey === "sections") {
    await applySectionPayload(ctx.workspaceId, body, id);
    Object.assign(existing, body, { workspaceId: current.workspaceId });
    await existing.save();
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
    return json({ item: existing });
  }
  if (resourceKey === "subjects") {
    await applySubjectPayload(ctx.workspaceId, body, id);
    Object.assign(existing, body, { workspaceId: current.workspaceId });
    await existing.save();
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
    return json({ item: existing });
  }
  if (resourceKey === "students" && "sectionId" in body && body.sectionId) {
    await assertSectionHasSeat(ctx.workspaceId, body.sectionId, id);
  }
  if (resourceKey === "staff") {
    const currentStaff = existing.toObject() as {
      staffType?: string;
      designation?: string;
      linkedTeacherId?: unknown;
    };
    const staffType = normalizeStaffType(body, currentStaff);
    const isTeacher = isTeacherStaff({
      staffType,
      designation: String(body.designation ?? currentStaff.designation ?? ""),
      linkedTeacherId: currentStaff.linkedTeacherId,
    });
    body.staffType = staffType;
    if ("enablePortalLogin" in body || !isTeacher) {
      body.enablePortalLogin = staffPortalLoginEnabled(body, isTeacher);
    }
  }
  Object.assign(existing, body, { workspaceId: current.workspaceId });
  await existing.save();
  if (resourceKey === "staff") {
    const staffDoc = existing as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      email?: string;
      phone?: string;
      department?: string;
      designation?: string;
      employeeId?: string;
      qualification?: string;
      experience?: string;
      joiningDate?: string;
      status?: string;
      staffType?: string;
      linkedTeacherId?: mongoose.Types.ObjectId;
      enablePortalLogin?: boolean;
    };
    const { login } = await syncStaffTeacherProfile(ctx.workspaceId, staffDoc, { createPassword: true });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
    return json({ item: existing, login: login ?? undefined });
  }
  if (resourceKey === "parents") {
    const parent = existing as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      email?: string;
      phone?: string;
      studentIds?: mongoose.Types.ObjectId[];
      status?: string;
    };
    const linked = await syncParentStudents(
      ctx.workspaceId,
      parent._id,
      parseObjectIds(parent.studentIds),
    );
    parent.studentIds = linked;
    await existing.save();
    const { user, temporaryPassword } = await ensureParentLogin({
      workspaceId: ctx.workspaceId,
      parent,
      createPassword: true,
    });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
    return json({
      item: existing,
      login:
        temporaryPassword && user
          ? { username: user.username, email: user.email, temporaryPassword, role: "Parent" }
          : undefined,
    });
  }
  if (resourceKey === "teachers") {
    const teacher = existing as unknown as {
      _id: mongoose.Types.ObjectId;
      staffId?: mongoose.Types.ObjectId;
      name: string;
      email?: string;
      phone?: string;
      department?: string;
      employeeId?: string;
      status?: string;
    };
    if (teacher.staffId) {
      throw new ApiError(403, "Edit this teacher from Settings → Staff.");
    }
    const { user, temporaryPassword } = await ensureTeacherLogin({
      workspaceId: ctx.workspaceId,
      teacher,
      createPassword: true,
    });
    await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
    return json({
      item: existing,
      login:
        temporaryPassword && user
          ? {
              name: teacher.name,
              username: user.username,
              email: user.email,
              temporaryPassword,
              role: "Teacher",
            }
          : undefined,
    });
  }
  await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.update`, resourceKey, id);
  return json({ item: existing });
}

export async function deleteResource(resourceKey: string, id: string) {
  const ctx = await requireWorkspaceContext();
  const resource = getResource(resourceKey);
  requireModuleEnabled(ctx, resourceKey);
  requirePerm(ctx, `${resource.permission}.delete`);
  const existing = await resource.model.findById(id);
  if (!existing) throw new ApiError(404, "Record not found.");
  const current = existing as unknown as TenantDoc & { deleteOne: () => Promise<unknown>; toObject: () => Record<string, unknown> };
  assertSameWorkspace(current.workspaceId, ctx.workspaceId);
  const teacherScope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherRecordAllowed(ctx, teacherScope, resourceKey, current.toObject());
  if (resourceKey === "homework") {
    assertHomeworkMutationAllowed(ctx);
  }
  if (resourceKey === "marks") {
    assertMarksMutationAllowed(ctx);
  }
  if (resourceKey === "results") {
    assertResultsMutationAllowed(ctx);
  }
  if (resourceKey === "leaveTypes" || resourceKey === "payroll") {
    assertTeacherHrConfigAllowed(ctx);
  }
  if (resourceKey === "parents") {
    await User.updateMany(
      { workspaceId: ctx.workspaceId, linkedParentId: existing._id },
      { $set: { status: "DISABLED" } },
    );
  }
  if (resourceKey === "teachers") {
    const teacher = existing as unknown as { staffId?: mongoose.Types.ObjectId };
    if (teacher.staffId) {
      throw new ApiError(403, "Remove or deactivate this teacher from Settings → Staff.");
    }
    await User.updateMany(
      { workspaceId: ctx.workspaceId, linkedTeacherId: existing._id },
      { $set: { status: "DISABLED" } },
    );
    await removeProfilePhoto(ctx.workspaceId, "teachers", id);
  }
  if (resourceKey === "students") {
    await removeProfilePhoto(ctx.workspaceId, "students", id);
  }
  await existing.deleteOne();
  await logWorkspace(ctx.session, ctx.workspaceId, `${resourceKey}.delete`, resourceKey, id);
  return json({ ok: true });
}
