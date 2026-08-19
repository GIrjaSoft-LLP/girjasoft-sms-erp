import { z } from "zod";
import { errorResponse, json } from "@/lib/api/guards";
import { findAdmissionDuplicates } from "@/lib/admissions/duplicates";
import { requireAdmissionContext } from "@/lib/admissions/guard";

const schema = z.object({
  mobile: z.string().optional(),
  email: z.string().optional(),
  aadhaar: z.string().optional(),
  studentName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  excludeApplicationId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmissionContext("admissions.view");
    const body = schema.parse(await request.json());
    const duplicates = await findAdmissionDuplicates(ctx.workspaceId, body);
    return json({ duplicates });
  } catch (error) {
    return errorResponse(error);
  }
}
