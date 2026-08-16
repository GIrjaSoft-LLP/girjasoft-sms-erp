import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { APP_NAME, COMPANY_NAME } from "@/config/branding";
import { ApiError, errorResponse, json, requireWorkspaceContext, scopedQuery } from "@/lib/api/guards";
import { visibleStudentFilter, visibleTeacherFilter } from "@/lib/id-card-access";
import { profilePhotoExists } from "@/lib/profile-photo";
import { Settings, Student, Teacher } from "@/models/workspace";
import { Workspace } from "@/models/platform";

function parseIds(raw: string | null) {
  return [...new Set((raw ?? "").split(/[\s,]+/).filter((id) => mongoose.isValidObjectId(id)))].slice(0, 100);
}

async function letterhead(workspaceId: string) {
  const workspace = await Workspace.findById(workspaceId).lean();
  const settings = await Settings.findOne(scopedQuery(workspaceId)).lean();
  const organization = (settings?.organization ?? {}) as { logo?: string };
  return {
    appName: APP_NAME,
    companyName: COMPANY_NAME,
    schoolName: workspace?.schoolName ?? workspace?.name ?? APP_NAME,
    logo: workspace?.logo || organization.logo || "",
    address: [workspace?.address, workspace?.city, workspace?.state, workspace?.pinCode].filter(Boolean).join(", "),
    phone: workspace?.phone ?? "",
    email: workspace?.email ?? "",
    website: workspace?.website ?? "",
    code: workspace?.code ?? "",
    academicSession: workspace?.academicSession ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceContext();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const ids = parseIds(url.searchParams.get("ids"));
    if (!ids.length) throw new ApiError(400, "Select at least one record.");
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    if (kind === "students") {
      const students = await Student.find({
        ...visibleStudentFilter(ctx),
        _id: { $in: objectIds },
      })
        .populate("classId", "name")
        .populate("sectionId", "name")
        .populate("parentId", "name phone")
        .populate("academicSessionId", "name")
        .lean();
      if (students.length !== ids.length) {
        throw new ApiError(403, "One or more students are not available.");
      }
      const brand = await letterhead(ctx.workspaceId);
      const photos = await profilePhotoExists(
        ctx.workspaceId,
        "students",
        students.map((row) => String(row._id)),
      );
      return json({
        kind,
        letterhead: brand,
        cards: students.map((row) => {
          const classDoc = row.classId as unknown as { name?: string } | null;
          const sectionDoc = row.sectionId as unknown as { name?: string } | null;
          const parent = row.parentId as unknown as { name?: string; phone?: string } | null;
          const session = row.academicSessionId as unknown as { name?: string } | null;
          const id = String(row._id);
          return {
            id,
            photo: (Boolean(row.photo) || photos.has(id)) ? `/api/students/${id}/photo` : "",
            name: row.name,
            admissionNumber: row.admissionNumber,
            className: classDoc?.name ?? "",
            sectionName: sectionDoc?.name ?? "",
            dateOfBirth: row.dateOfBirth || "",
            parentName: parent?.name ?? "",
            phone: row.phone || parent?.phone || "",
            academicSession: session?.name || brand.academicSession,
          };
        }),
      });
    }

    if (kind === "teachers") {
      const teachers = await Teacher.find({
        ...visibleTeacherFilter(ctx),
        _id: { $in: objectIds },
      }).lean();
      if (teachers.length !== ids.length) {
        throw new ApiError(403, "One or more teachers are not available.");
      }
      const brand = await letterhead(ctx.workspaceId);
      const photos = await profilePhotoExists(
        ctx.workspaceId,
        "teachers",
        teachers.map((row) => String(row._id)),
      );
      return json({
        kind,
        letterhead: brand,
        cards: teachers.map((row) => ({
          id: String(row._id),
          photo: (Boolean(row.photo) || photos.has(String(row._id))) ? `/api/teachers/${String(row._id)}/photo` : "",
          name: row.name,
          employeeId: row.employeeId,
          designation: "Teacher",
          department: row.department || "",
          phone: row.phone || "",
          email: row.email || "",
          joiningDate: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "",
          academicSession: brand.academicSession,
        })),
      });
    }

    throw new ApiError(400, "Unknown ID card type.");
  } catch (error) {
    return errorResponse(error);
  }
}
