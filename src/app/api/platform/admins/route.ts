import { z } from "zod";
import { ApiError, errorResponse, json, requirePlatformPerm } from "@/lib/api/guards";
import { logPlatform } from "@/lib/audit";
import { assertNotLastAdmin, ensurePlatformSystemRoles } from "@/lib/platform-access";
import { hashPassword } from "@/lib/password";
import { PlatformAdmin } from "@/models/platform";

export async function GET() {
  try {
    await requirePlatformPerm("platform.users.view");
    await ensurePlatformSystemRoles();
    const items = await PlatformAdmin.find().select("-passwordHash").sort({ name: 1 }).lean();
    return json({
      items: items.map((row) => ({
        ...row,
        photo: `/api/platform/admins/${String(row._id)}/photo`,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePlatformPerm("platform.users.create");
    const body = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional().default(""),
        username: z.string().min(3),
        password: z.string().min(10),
        role: z.enum(["ADMIN", "READER", "TICKET_ADMIN"]),
        status: z.enum(["ACTIVE", "DISABLED"]).optional().default("ACTIVE"),
      })
      .parse(await request.json());
    const email = body.email.toLowerCase();
    const existing = await PlatformAdmin.findOne({ $or: [{ email }, { username: body.username.toLowerCase() }] });
    if (existing) throw new ApiError(409, "Email or username already exists.");
    const created = await PlatformAdmin.create({
      name: body.name,
      email,
      phone: body.phone,
      username: body.username.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role: body.role,
      status: body.status,
    });
    await logPlatform(session, "PLATFORM_USER_CREATED", { email, role: body.role });
    return json({ item: created }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
