import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/guards";
import {
  createResource,
  deleteResource,
  getResourceById,
  listResource,
  updateResource,
} from "@/lib/api/tenant-resource";

type Ctx = { params: Promise<{ resource: string }> };
type IdCtx = { params: Promise<{ resource: string; id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { resource } = await ctx.params;
    return await listResource(resource, request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { resource } = await ctx.params;
    return await createResource(resource, request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getById(request: NextRequest, ctx: IdCtx) {
  try {
    const { resource, id } = await ctx.params;
    return await getResourceById(resource, id);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function patchById(request: NextRequest, ctx: IdCtx) {
  try {
    const { resource, id } = await ctx.params;
    return await updateResource(resource, id, request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function deleteById(_request: NextRequest, ctx: IdCtx) {
  try {
    const { resource, id } = await ctx.params;
    return await deleteResource(resource, id);
  } catch (error) {
    return errorResponse(error);
  }
}
