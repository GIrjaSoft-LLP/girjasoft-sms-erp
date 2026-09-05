import mongoose from "mongoose";
import { ApiError } from "@/lib/api/errors";
import type { TenantContext } from "@/lib/api/guards";
import { hasPermission, isParentLike, isStudentLike, isTeacherLike } from "@/lib/rbac";
import { isWorkspaceAdmin } from "@/lib/workspace-admin";
import { assertTeacherAssignmentAllowed, hydrateTeacherContextLabels } from "@/lib/teacher-context";
import { assertTeacherRecordAllowed, resolveTeacherAssignmentScope } from "@/lib/teacher-scope";
import {
  assertHomeworkMutationAllowed,
  assertHomeworkVisibleToFamily,
  isHomeworkReadOnlyActor,
} from "@/lib/homework/access";
import { Homework, SchoolClass, Section, Subject, Teacher } from "@/models/workspace";

export type HomeworkViewerMode = "admin" | "teacher" | "parent" | "student";

export type HomeworkLookupOption = { _id: string; name: string; classId?: string };

export type HomeworkFormContext = {
  mode: HomeworkViewerMode;
  ready: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  message?: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  classes: HomeworkLookupOption[];
  sections: HomeworkLookupOption[];
  subjects: HomeworkLookupOption[];
};

function emptyLookups() {
  return { classes: [] as HomeworkLookupOption[], sections: [] as HomeworkLookupOption[], subjects: [] as HomeworkLookupOption[] };
}

function getHomeworkViewerMode(ctx: TenantContext): HomeworkViewerMode {
  if (ctx.impersonating || isWorkspaceAdmin(ctx)) return "admin";
  if (isTeacherLike(ctx.session.roleSlugs)) return "teacher";
  if (isParentLike(ctx.session.roleSlugs)) return "parent";
  if (isStudentLike(ctx.session.roleSlugs)) return "student";
  return "admin";
}

export function isTeacherHomeworkActor(ctx: TenantContext) {
  return isTeacherLike(ctx.session.roleSlugs) && !ctx.impersonating && !isWorkspaceAdmin(ctx);
}

async function getAdminHomeworkLookups(workspaceId: string) {
  const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
  const [classes, sections, subjects] = await Promise.all([
    SchoolClass.find({ workspaceId: wsObjectId, status: { $ne: "INACTIVE" } })
      .sort({ numericName: 1, name: 1 })
      .select("name")
      .lean(),
    Section.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
    Subject.find({ workspaceId: wsObjectId }).sort({ name: 1 }).select("name classId").lean(),
  ]);
  return {
    classes: classes.map((row) => ({ _id: String(row._id), name: row.name })),
    sections: sections.map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
    subjects: subjects.map((row) => ({ _id: String(row._id), name: row.name, classId: String(row.classId) })),
  };
}

export async function resolveTeacherHomeworkFormContext(ctx: TenantContext): Promise<HomeworkFormContext> {
  const mode = getHomeworkViewerMode(ctx);
  const canCreate = hasPermission(ctx.permissions, "homework.create") && mode !== "parent" && mode !== "student";
  const canEdit = hasPermission(ctx.permissions, "homework.edit") && mode !== "parent" && mode !== "student";
  const canDelete = hasPermission(ctx.permissions, "homework.delete") && mode !== "parent" && mode !== "student";

  if (mode === "parent" || mode === "student") {
    return {
      mode,
      ready: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      classId: "",
      sectionId: "",
      subjectId: "",
      className: "",
      sectionName: "",
      subjectName: "",
      ...emptyLookups(),
    };
  }

  if (mode === "admin") {
    return {
      mode: "admin",
      ready: true,
      canCreate,
      canEdit,
      canDelete,
      classId: "",
      sectionId: "",
      subjectId: "",
      className: "",
      sectionName: "",
      subjectName: "",
      ...(await getAdminHomeworkLookups(ctx.workspaceId)),
    };
  }

  if (!ctx.session.linkedTeacherId) {
    return {
      mode: "teacher",
      ready: false,
      canCreate: false,
      canEdit,
      canDelete,
      message: "Your teacher account is not linked. Contact your administrator.",
      classId: "",
      sectionId: "",
      subjectId: "",
      className: "",
      sectionName: "",
      subjectName: "",
      ...emptyLookups(),
    };
  }

  const classId = ctx.session.teacherContextClassId ?? "";
  const sectionId = ctx.session.teacherContextSectionId ?? "";
  let subjectId = ctx.session.teacherContextSubjectId ?? "";

  if (!classId || !sectionId) {
    return {
      mode: "teacher",
      ready: false,
      canCreate: false,
      canEdit,
      canDelete,
      message: "Please select today's class before creating homework.",
      classId: "",
      sectionId: "",
      subjectId: "",
      className: "",
      sectionName: "",
      subjectName: "",
      ...emptyLookups(),
    };
  }

  await assertTeacherAssignmentAllowed(ctx.workspaceId, ctx.session.linkedTeacherId, {
    classId,
    sectionId,
    subjectId: subjectId || null,
  });

  if (!subjectId) {
    const { getTeacherAssignmentOptions } = await import("@/lib/teacher-context");
    const { assignments } = await getTeacherAssignmentOptions(ctx.workspaceId, ctx.session.linkedTeacherId);
    const match = assignments.find(
      (item) => item.classId === classId && item.sectionId === sectionId && item.subjectId,
    );
    subjectId = match?.subjectId ?? "";
  }

  if (!subjectId) {
    return {
      mode: "teacher",
      ready: false,
      canCreate: false,
      canEdit,
      canDelete,
      message: "Please select a subject in today's class before creating homework.",
      classId,
      sectionId,
      subjectId: "",
      className: "",
      sectionName: "",
      subjectName: "",
      ...emptyLookups(),
    };
  }

  await assertTeacherAssignmentAllowed(ctx.workspaceId, ctx.session.linkedTeacherId, {
    classId,
    sectionId,
    subjectId,
  });

  const labels = await hydrateTeacherContextLabels(ctx.workspaceId, { classId, sectionId, subjectId });

  return {
    mode: "teacher",
    ready: true,
    canCreate,
    canEdit,
    canDelete,
    classId,
    sectionId,
    subjectId,
    className: labels.className,
    sectionName: labels.sectionName,
    subjectName: labels.subjectName,
    ...emptyLookups(),
  };
}

async function assertWorkspaceClassSelection(
  workspaceId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
) {
  if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(sectionId) || !mongoose.isValidObjectId(subjectId)) {
    throw new ApiError(400, "Class, section and subject are required.");
  }
  const wsObjectId = new mongoose.Types.ObjectId(workspaceId);
  const [classDoc, sectionDoc, subjectDoc] = await Promise.all([
    SchoolClass.findOne({ _id: classId, workspaceId: wsObjectId }).select("_id").lean(),
    Section.findOne({ _id: sectionId, workspaceId: wsObjectId, classId }).select("_id").lean(),
    Subject.findOne({ _id: subjectId, workspaceId: wsObjectId, classId }).select("_id").lean(),
  ]);
  if (!classDoc) throw new ApiError(400, "Selected class was not found in this workspace.");
  if (!sectionDoc) throw new ApiError(400, "Selected section does not belong to the selected class.");
  if (!subjectDoc) throw new ApiError(400, "Selected subject does not belong to the selected class.");
}

export async function assertHomeworkCreateAllowed(ctx: TenantContext, body: Record<string, unknown>) {
  assertHomeworkMutationAllowed(ctx);
  if (
    !ctx.impersonating &&
    !hasPermission(ctx.permissions, "homework.create") &&
    !isTeacherHomeworkActor(ctx)
  ) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  if (isTeacherHomeworkActor(ctx)) {
    if (!ctx.session.linkedTeacherId) {
      throw new ApiError(403, "Teacher account is not linked.");
    }
    const formContext = await resolveTeacherHomeworkFormContext(ctx);
    if (!formContext.ready) {
      throw new ApiError(400, formContext.message ?? "Today's class is not set.");
    }

    const title = String(body.title ?? "").trim();
    const dueDate = String(body.dueDate ?? "").trim();
    if (!title) throw new ApiError(400, "Title is required.");
    if (!dueDate) throw new ApiError(400, "Due date is required.");

    body.classId = formContext.classId;
    body.sectionId = formContext.sectionId;
    body.subjectId = formContext.subjectId;
    body.teacherId = ctx.session.linkedTeacherId;
    return;
  }

  const title = String(body.title ?? "").trim();
  const dueDate = String(body.dueDate ?? "").trim();
  if (!title) throw new ApiError(400, "Title is required.");
  if (!dueDate) throw new ApiError(400, "Due date is required.");

  const classId = String(body.classId ?? "");
  const sectionId = String(body.sectionId ?? "");
  const subjectId = String(body.subjectId ?? "");
  await assertWorkspaceClassSelection(ctx.workspaceId, classId, sectionId, subjectId);
  body.classId = classId;
  body.sectionId = sectionId;
  body.subjectId = subjectId;
}

export async function assertHomeworkUpdateAllowed(
  ctx: TenantContext,
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  assertHomeworkMutationAllowed(ctx);
  const scope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherRecordAllowed(ctx, scope, "homework", existing);

  if (isTeacherHomeworkActor(ctx)) {
    delete body.classId;
    delete body.sectionId;
    delete body.subjectId;
    delete body.teacherId;
    delete body.workspaceId;

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const dueDate = body.dueDate !== undefined ? String(body.dueDate).trim() : undefined;
    if (title !== undefined && !title) throw new ApiError(400, "Title is required.");
    if (dueDate !== undefined && !dueDate) throw new ApiError(400, "Due date is required.");
  }
}

async function loadAuthorizedHomework(ctx: TenantContext, id: string) {
  const item = await Homework.findOne({
    workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
    _id: id,
  }).lean();
  if (!item) throw new ApiError(404, "Homework not found.");

  await assertHomeworkVisibleToFamily(ctx, item);
  const scope = await resolveTeacherAssignmentScope(ctx);
  await assertTeacherRecordAllowed(ctx, scope, "homework", item as Record<string, unknown>);

  const labels = await hydrateTeacherContextLabels(ctx.workspaceId, {
    classId: String(item.classId ?? ""),
    sectionId: String(item.sectionId ?? ""),
    subjectId: item.subjectId ? String(item.subjectId) : "",
  });

  return { item, labels };
}

export async function getHomeworkForEdit(ctx: TenantContext, id: string) {
  if (isHomeworkReadOnlyActor(ctx)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const { item, labels } = await loadAuthorizedHomework(ctx, id);
  return {
    _id: String(item._id),
    title: item.title,
    description: item.description ?? "",
    dueDate: item.dueDate ?? "",
    classId: item.classId ? String(item.classId) : "",
    sectionId: item.sectionId ? String(item.sectionId) : "",
    subjectId: item.subjectId ? String(item.subjectId) : "",
    className: labels.className,
    sectionName: labels.sectionName,
    subjectName: labels.subjectName,
    teacherId: item.teacherId ? String(item.teacherId) : "",
  };
}

export async function getHomeworkForView(ctx: TenantContext, id: string) {
  const { item, labels } = await loadAuthorizedHomework(ctx, id);
  const teacherId = item.teacherId ? String(item.teacherId) : "";
  const teacher = teacherId
    ? await Teacher.findOne({
        _id: teacherId,
        workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
      })
        .select("name")
        .lean()
    : null;

  return {
    title: item.title,
    description: item.description ?? "",
    dueDate: item.dueDate ?? "",
    className: labels.className,
    sectionName: labels.sectionName,
    subjectName: labels.subjectName,
    teacherName: teacher?.name ?? "",
    createdAt: item.createdAt ? String(item.createdAt) : "",
  };
}
