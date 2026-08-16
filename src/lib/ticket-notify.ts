import mongoose from "mongoose";
import { Notification } from "@/models/workspace";

export async function notifySchoolUser(workspaceId: string, userId: string, title: string, body: string) {
  if (!userId) return;
  await Notification.create({
    workspaceId,
    userId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    title,
    body,
    read: false,
  });
}
