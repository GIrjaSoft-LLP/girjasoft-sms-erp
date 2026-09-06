import mongoose, { Schema } from "mongoose";

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    schoolName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "India" },
    pinCode: { type: String, default: "" },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
    academicSession: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DISABLED", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    lastActivityAt: { type: Date, default: Date.now },
    validityTill: { type: Date, default: null },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    enabledModules: { type: [String], default: [] },
    moduleConfigVersion: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, default: null },
    archivedByEmail: { type: String, default: "" },
    statusBeforeArchive: { type: String, default: "" },
  },
  { timestamps: true },
);

workspaceSchema.index({ status: 1, createdAt: -1 });

const platformAdminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: "ADMIN", index: true },
    phone: { type: String, default: "" },
    photo: { type: String, default: "" },
    accountType: { type: String, enum: ["PLATFORM"], default: "PLATFORM" },
    workspaceId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" },
    lastLoginAt: { type: Date, default: null },
    designPreferences: {
      theme: { type: String, default: "" },
      mode: { type: String, default: "system" },
      accentColor: { type: String, default: "" },
      customized: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

const platformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const platformAuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

platformAuditLogSchema.index({ createdAt: -1 });

const platformRoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, default: "" },
    permissions: [{ type: String }],
    isSystem: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" },
  },
  { timestamps: true },
);

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);
export const PlatformAdmin =
  mongoose.models.PlatformAdmin ||
  mongoose.model("PlatformAdmin", platformAdminSchema, "platformAdmins");
export const PlatformRole =
  mongoose.models.PlatformRole || mongoose.model("PlatformRole", platformRoleSchema, "platformRoles");
export const PlatformSettings =
  mongoose.models.PlatformSettings ||
  mongoose.model("PlatformSettings", platformSettingsSchema, "platformSettings");
export const PlatformAuditLog =
  mongoose.models.PlatformAuditLog ||
  mongoose.model("PlatformAuditLog", platformAuditLogSchema, "platformAuditLogs");

if (!Workspace.schema.path("validityTill")) {
  Workspace.schema.add({ validityTill: { type: Date, default: null } });
}
if (!Workspace.schema.path("enabledModules")) {
  Workspace.schema.add({ enabledModules: { type: [String], default: [] } });
}
if (!Workspace.schema.path("moduleConfigVersion")) {
  Workspace.schema.add({ moduleConfigVersion: { type: Number, default: 0 } });
}
if (!Workspace.schema.path("archivedAt")) {
  Workspace.schema.add({
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, default: null },
    archivedByEmail: { type: String, default: "" },
    statusBeforeArchive: { type: String, default: "" },
  });
}
if (!PlatformAdmin.schema.path("photo")) {
  PlatformAdmin.schema.add({ photo: { type: String, default: "" } });
}
if (!PlatformAdmin.schema.path("phone")) {
  PlatformAdmin.schema.add({ phone: { type: String, default: "" } });
}
