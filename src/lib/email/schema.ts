import { z } from "zod";

export const emailClientPatchSchema = z.object({
  enabled: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  encryption: z.enum(["none", "ssl", "tls", "starttls"]).optional(),
  authEnabled: z.boolean().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.union([z.string().email(), z.literal("")]).optional(),
  fromName: z.string().optional(),
  replyToEmail: z.union([z.string().email(), z.literal("")]).optional(),
  incomingServer: z.string().optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  pop3Port: z.coerce.number().int().min(1).max(65535).optional(),
});

export type EmailClientPatch = z.infer<typeof emailClientPatchSchema>;
