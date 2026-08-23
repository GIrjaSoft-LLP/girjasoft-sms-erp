import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    username: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    department: { type: String, default: "" },
    employeeId: { type: String, default: "" },
    roleIds: [{ type: Schema.Types.ObjectId, ref: "Role" }],
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE", index: true },
    accountType: { type: String, enum: ["WORKSPACE"], default: "WORKSPACE" },
    lastLoginAt: { type: Date, default: null },
    linkedStudentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    linkedStudentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    linkedTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    linkedStaffId: { type: Schema.Types.ObjectId, ref: "Staff", default: null },
    linkedParentId: { type: Schema.Types.ObjectId, ref: "Parent", default: null },
    teacherContextClassId: { type: Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    teacherContextSectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    teacherContextSubjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    teacherContextDate: { type: String, default: "" },
    allowMultipleRoles: { type: Boolean, default: true },
    designPreferences: {
      theme: { type: String, default: "" },
      mode: { type: String, default: "system" },
      accentColor: { type: String, default: "" },
      customized: { type: Boolean, default: false },
    },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
userSchema.index({ workspaceId: 1, username: 1 }, { unique: true });
userSchema.index({ workspaceId: 1, employeeId: 1 }, { unique: true, sparse: true });
userSchema.index({ workspaceId: 1, status: 1 });

const roleSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    department: { type: String, default: "" },
    description: { type: String, default: "" },
    permissions: [{ type: String }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roleSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });
roleSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema, "users");
export const Role = mongoose.models.Role || mongoose.model("Role", roleSchema, "roles");
