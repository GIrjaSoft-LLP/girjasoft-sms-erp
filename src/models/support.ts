import mongoose, { Schema } from "mongoose";

const attachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    mime: { type: String, default: "" },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    authorType: { type: String, enum: ["SCHOOL", "PLATFORM"], required: true },
    authorId: { type: String, default: "" },
    authorName: { type: String, required: true },
    body: { type: String, required: true },
    visibility: { type: String, enum: ["PUBLIC", "INTERNAL"], default: "PUBLIC" },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true },
);

const eventSchema = new Schema(
  {
    action: { type: String, required: true },
    actorName: { type: String, default: "" },
    actorType: { type: String, enum: ["SCHOOL", "PLATFORM"], default: "SCHOOL" },
    detail: { type: String, default: "" },
  },
  { timestamps: true },
);

const supportTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    schoolName: { type: String, default: "" },
    schoolCode: { type: String, default: "" },
    createdByUserId: { type: String, required: true },
    createdByName: { type: String, required: true },
    createdByEmail: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    type: { type: String, enum: ["INCIDENT", "REQUEST"], required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM", index: true },
    module: { type: String, default: "Other" },
    page: { type: String, default: "" },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_SCHOOL", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    assignedToId: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    assignedAt: { type: Date, default: null },
    resolution: { type: String, default: "" },
    unreadForSchool: { type: Boolean, default: false },
    unreadForPlatform: { type: Boolean, default: true },
    attachments: { type: [attachmentSchema], default: [] },
    messages: { type: [messageSchema], default: [] },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);

supportTicketSchema.index({ workspaceId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema, "supportTickets");
