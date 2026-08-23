import { createHash } from "node:crypto";
import { z } from "zod";
import { errorResponse, json } from "@/lib/api/guards";
import { logWorkspace } from "@/lib/audit";
import { connectMongo } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { User } from "@/models/identity";
import { Workspace } from "@/models/platform";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(10),
  workspaceCode: z.string().min(1),
});

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    await connectMongo();
    const body = schema.parse(await request.json());
    const workspace = await Workspace.findOne({ code: body.workspaceCode.trim().toUpperCase() });
    if (!workspace) {
      return json({ error: "Invalid or expired reset link." }, 400);
    }

    const tokenHash = hashResetToken(body.token);
    const user = await User.findOne({
      workspaceId: workspace._id,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("+resetTokenHash");

    if (!user) {
      return json({ error: "Invalid or expired reset link." }, 400);
    }

    user.passwordHash = await hashPassword(body.password);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    await logWorkspace(
      {
        sub: String(user._id),
        email: user.email,
        name: user.name,
        accountType: "WORKSPACE",
        sessionRole: "WORKSPACE_USER",
        workspaceId: String(workspace._id),
        permissions: [],
        roleSlugs: [],
      },
      String(workspace._id),
      "PASSWORD_RESET_COMPLETED",
      "users",
      String(user._id),
    );

    return json({ message: "Password updated successfully. You can now sign in." });
  } catch (error) {
    return errorResponse(error);
  }
}
