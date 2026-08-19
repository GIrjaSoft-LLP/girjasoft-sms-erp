import type { SessionPayload } from "@/lib/session";

export function pushWorkflowEvent(
  application: {
    workflowHistory: Array<{
      action: string;
      status?: string;
      userId?: string;
      userEmail?: string;
      remarks?: string;
      at?: Date;
      previousValue?: unknown;
      newValue?: unknown;
    }>;
    status: string;
  },
  session: SessionPayload,
  action: string,
  nextStatus: string,
  remarks = "",
  previousValue?: unknown,
  newValue?: unknown,
) {
  application.workflowHistory.push({
    action,
    status: nextStatus,
    userId: session.sub,
    userEmail: session.email,
    remarks,
    at: new Date(),
    previousValue,
    newValue,
  });
  application.status = nextStatus;
}
