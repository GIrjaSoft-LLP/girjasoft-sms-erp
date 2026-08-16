import mongoose from "mongoose";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";
import { DEFAULT_USER_PASSWORD } from "@/config/defaults";
import { USER_EXCEL_HEADERS } from "@/config/excel";
import {
  ApiError,
  errorResponse,
  requirePerm,
  requireWorkspaceContext,
  scopedQuery,
} from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { cell, excelFileResponse, readExcelObjects, rowsToExcelBuffer } from "@/lib/excel";
import { hashPassword } from "@/lib/password";
import { staffUserQuery } from "@/lib/parent-account";
import { Role, User } from "@/models/identity";

export async function GET(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "users.view");
    const url = new URL(request.url);
    const template = url.searchParams.get("template") === "1";
    const users = template
      ? []
      : await User.find(await staffUserQuery(ctx.workspaceId, scopedQuery(ctx.workspaceId)))
          .select("-passwordHash -resetTokenHash")
          .populate("roleIds", "name slug")
          .sort({ name: 1 })
          .lean();
    const rows = template
      ? [
          {
            name: "Sample Admin",
            email: "admin@school.com",
            phone: "9999999999",
            username: "schooladmin",
            department: "Administration",
            employeeId: "ADM-001",
            role: "Workspace Admin",
            status: "ACTIVE",
          },
        ]
      : users
          .filter((user) => user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase())
          .map((user) => ({
            name: user.name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            department: user.department,
            employeeId: user.employeeId ?? "",
            role: Array.isArray(user.roleIds)
              ? user.roleIds
                  .map((role: { name?: string }) => role.name)
                  .filter(Boolean)
                  .join(", ")
              : "",
            status: user.status,
          }));
    const buffer = await rowsToExcelBuffer("Users", USER_EXCEL_HEADERS, rows);
    return excelFileResponse(
      buffer,
      template ? "girjasoft-users-template.xlsx" : "girjasoft-users.xlsx",
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "users.create");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Excel file is required.");
    const rows = await readExcelObjects(Buffer.from(await file.arrayBuffer()));
    const roles = await Role.find(scopedQuery(ctx.workspaceId)).lean();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const name = cell(row, "name");
      const email = cell(row, "email").toLowerCase();
      const username = (cell(row, "username") || email.split("@")[0] || "").toLowerCase();
      const roleName = cell(row, "role");
      if (!name || !email || !username || !roleName) {
        errors.push(`Row ${index + 2}: name, email, username and role are required.`);
        continue;
      }
      if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
        errors.push(`Row ${index + 2}: cannot import platform Super Admin.`);
        continue;
      }
      const role = roles.find(
        (item) =>
          item.name.toLowerCase() === roleName.toLowerCase() ||
          item.slug.toLowerCase() === roleName.toLowerCase().replace(/\s+/g, "_"),
      );
      if (!role) {
        errors.push(`Row ${index + 2}: role "${roleName}" was not found in this workspace.`);
        continue;
      }
      if (role.slug === "parent" || role.slug === "student" || role.slug === "teacher") {
        errors.push(`Row ${index + 2}: create ${role.slug} accounts from their own module.`);
        continue;
      }
      try {
        const existing = await User.findOne(
          scopedQuery(ctx.workspaceId, { $or: [{ email }, { username }] }),
        );
        if (existing) {
          skipped += 1;
          continue;
        }
        await User.create({
          workspaceId: new mongoose.Types.ObjectId(ctx.workspaceId),
          name,
          email,
          phone: cell(row, "phone") || "",
          username,
          passwordHash: await hashPassword(DEFAULT_USER_PASSWORD),
          department: cell(row, "department") || "",
          employeeId: cell(row, "employeeId") || undefined,
          roleIds: [role._id],
          status: cell(row, "status") || "ACTIVE",
        });
        created += 1;
      } catch (err) {
        errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await logWorkspace(ctx.session, ctx.workspaceId, "USERS_IMPORTED", "users", "", {
      created,
      skipped,
    });
    return Response.json({ created, skipped, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
