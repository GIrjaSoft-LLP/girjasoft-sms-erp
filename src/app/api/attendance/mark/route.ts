import { z } from "zod";
import { errorResponse, json } from "@/lib/api/guards";
import { requireAttendanceContext } from "@/lib/attendance/guard";
import { saveAttendanceMarking } from "@/lib/attendance/service";

const schema = z.object({
  date: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  attendanceType: z.enum(["CLASS", "SUBJECT"]),
  subjectId: z.string().optional().nullable(),
  academicSessionId: z.string().optional().nullable(),
  submit: z.boolean().optional(),
  reason: z.string().optional(),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
      remarks: z.string().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireAttendanceContext("attendance.create");
    const body = schema.parse(await request.json());
    const result = await saveAttendanceMarking(ctx, body);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
