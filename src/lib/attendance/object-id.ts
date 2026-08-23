import mongoose from "mongoose";

const INVALID = new Set(["null", "undefined", ""]);

export function isValidObjectId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || INVALID.has(trimmed)) return false;
  return mongoose.Types.ObjectId.isValid(trimmed);
}

export function optionalObjectId(value: unknown) {
  return isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined;
}

export function collectValidObjectIds(values: unknown[]) {
  return [...new Set(values.map((value) => String(value)).filter(isValidObjectId))];
}
