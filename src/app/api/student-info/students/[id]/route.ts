import { z } from "zod";
import mongoose from "mongoose";
import { errorResponse, json, requirePerm, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { isParentLike } from "@/lib/rbac";
import { assertPortalCanViewStudent } from "@/lib/parent-access";
import {
  assertTeacherRecordAllowed,
  assertTeacherScopeAllowed,
  resolveTeacherAssignmentScope,
} from "@/lib/teacher-scope";
import { getStudentProfileEnrollment } from "@/lib/promotion/service";
import { updateCurrentEnrollment } from "@/lib/enrollment/service";
import { STUDENT_EDITABLE_FIELDS } from "@/config/promotion";
import { User } from "@/models/identity";
import { Parent, SchoolClass, Section, Student } from "@/models/workspace";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.view");

    const query = scopedQuery(ctx.workspaceId, { _id: id });
    const student = await Student.findOne(query).lean();
    if (!student) {
      return json({ error: "Student not found." }, 404);
    }

    if (isParentLike(ctx.session.roleSlugs) && !ctx.impersonating) {
      await assertPortalCanViewStudent(ctx, id);
    }

    const teacherScope = await resolveTeacherAssignmentScope(ctx);
    if (teacherScope.restricted) {
      assertTeacherScopeAllowed(teacherScope, {
        classId: student.classId ? String(student.classId) : undefined,
        sectionId: student.sectionId ? String(student.sectionId) : undefined,
      });
    }

    let enrollment = { current: null as Record<string, unknown> | null, history: [] as Record<string, unknown>[] };
    try {
      enrollment = await getStudentProfileEnrollment(ctx, id);
    } catch {
      enrollment = { current: null, history: [] };
    }

    const [classDoc, sectionDoc, parent, parentLogin] = await Promise.all([
      student.classId ? SchoolClass.findById(student.classId).select("name").lean() : null,
      student.sectionId ? Section.findById(student.sectionId).select("name").lean() : null,
      student.parentId ? Parent.findById(student.parentId).lean() : null,
      student.parentId
        ? User.findOne({ workspaceId: ctx.workspaceId, linkedParentId: student.parentId })
            .select("username email status")
            .lean()
        : null,
    ]);

    let siblings: Array<{ _id: string; name: string; admissionNumber: string }> = [];
    if (parent?.studentIds?.length) {
      const rows = await Student.find({
        workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
        _id: { $in: parent.studentIds },
      })
        .select("name admissionNumber")
        .lean();
      siblings = rows.map((row) => ({
        _id: String(row._id),
        name: row.name,
        admissionNumber: row.admissionNumber,
      }));
    }

    return json({
      student: {
        _id: String(student._id),
        admissionNumber: student.admissionNumber,
        studentCode: student.admissionNumber,
        name: student.name,
        firstName: student.firstName ?? "",
        middleName: student.middleName ?? "",
        lastName: student.lastName ?? "",
        gender: student.gender ?? "",
        dateOfBirth: student.dateOfBirth ?? "",
        bloodGroup: student.bloodGroup ?? "",
        aadhaar: student.aadhaar ?? "",
        nationality: student.nationality ?? "",
        religion: student.religion ?? "",
        category: student.category ?? "",
        motherTongue: student.motherTongue ?? "",
        phone: student.phone ?? "",
        email: student.email ?? "",
        address: student.address ?? "",
        emergencyContact: student.emergencyContact ?? "",
        emergencyPhone: student.emergencyPhone ?? "",
        photo: student.photo ?? "",
        status: student.status ?? "ACTIVE",
        className: classDoc?.name ?? "",
        sectionName: sectionDoc?.name ?? "",
        classId: student.classId ? String(student.classId) : "",
        sectionId: student.sectionId ? String(student.sectionId) : "",
        academicSessionId: student.academicSessionId ? String(student.academicSessionId) : "",
        currentEnrollment: enrollment.current,
        academicHistory: enrollment.history,
      },
      parent: parent
        ? {
            _id: String(parent._id),
            name: parent.name,
            email: parent.email ?? "",
            phone: parent.phone ?? "",
            relation: parent.relation ?? "",
            address: parent.address ?? "",
            status: parent.status ?? "ACTIVE",
            login: parentLogin
              ? {
                  username: parentLogin.username,
                  email: parentLogin.email,
                  status: parentLogin.status,
                }
              : null,
            children: siblings,
          }
        : null,
      enabledModuleIds: ctx.enabledModules,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z
  .object({
    name: z.string().optional(),
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().optional(),
    bloodGroup: z.string().optional(),
    aadhaar: z.string().optional(),
    nationality: z.string().optional(),
    religion: z.string().optional(),
    category: z.string().optional(),
    motherTongue: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    status: z.string().optional(),
    classId: z.string().optional(),
    sectionId: z.string().optional(),
    rollNumber: z.string().optional(),
    reason: z.string().optional(),
    overrideCapacity: z.boolean().optional(),
    parent: z
      .object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        relation: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.edit");
    const body = patchSchema.parse(await request.json());

    const student = await Student.findOne(scopedQuery(ctx.workspaceId, { _id: id }));
    if (!student) return json({ error: "Student not found." }, 404);

    const teacherScope = await resolveTeacherAssignmentScope(ctx);
    await assertTeacherRecordAllowed(ctx, teacherScope, "students", student.toObject());

    for (const key of STUDENT_EDITABLE_FIELDS) {
      if (key in body) {
        (student as Record<string, unknown>)[key] = body[key as keyof typeof body];
      }
    }

    if (body.firstName || body.middleName || body.lastName) {
      const composed = [body.firstName ?? student.firstName, body.middleName ?? student.middleName, body.lastName ?? student.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (composed) student.name = composed;
    }

    if (body.parent && student.parentId) {
      await Parent.findByIdAndUpdate(student.parentId, { $set: body.parent });
    }

    if (body.classId || body.sectionId || body.rollNumber !== undefined) {
      await updateCurrentEnrollment(ctx.workspaceId, id, {
        classId: body.classId,
        sectionId: body.sectionId,
        rollNumber: body.rollNumber,
        reason: body.reason,
        changedBy: ctx.session.sub,
        changedByEmail: ctx.session.email,
        overrideCapacity: body.overrideCapacity,
      });
    } else {
      await student.save();
    }

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
