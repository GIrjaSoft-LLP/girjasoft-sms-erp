import { deleteById, getById, patchById } from "@/lib/api/resource-handlers";

export const GET = getById;
export const PATCH = patchById;
export const DELETE = deleteById;
