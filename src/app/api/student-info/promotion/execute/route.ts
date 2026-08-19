import { z } from "zod";
import { errorResponse, json } from "@/lib/api/guards";
import { requireWorkspaceContext, requirePerm } from "@/lib/api/guards";
import { executePromotion, previewPromotion } from "@/lib/promotion/service";

const itemSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  rollNumber: z.string().optional(),
  promotionStatus: z
    .enum(["PROMOTED", "NOT_PROMOTED", "TRANSFERRED", "GRADUATED", "ARCHIVED", "ENROLLED", "PENDING"])
    .optional(),
});

const schema = z.object({
  fromSessionId: z.string().min(1),
  toSessionId: z.string().min(1),
  items: z.array(itemSchema).min(1),
  reason: z.string().optional(),
  overrideCapacity: z.boolean().optional(),
  confirm: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireWorkspaceContext();
    requirePerm(ctx, "students.promote");
    const body = schema.parse(await request.json());

    if (!body.confirm) {
      const preview = await previewPromotion(ctx, body);
      return json({ preview });
    }

    const result = await executePromotion(ctx, body);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
