export type EmailEncryption = "none" | "ssl" | "tls" | "starttls";

export type EmailClientConfig = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  encryption: EmailEncryption;
  authEnabled: boolean;
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  incomingServer: string;
  imapPort: number;
  pop3Port: number;
  testedAt: string | null;
  lastTestSuccess: boolean;
};

export const DEFAULT_EMAIL_CLIENT: EmailClientConfig = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  encryption: "starttls",
  authEnabled: true,
  smtpUsername: "",
  smtpPasswordEncrypted: "",
  fromEmail: "",
  fromName: "",
  replyToEmail: "",
  incomingServer: "",
  imapPort: 993,
  pop3Port: 995,
  testedAt: null,
  lastTestSuccess: false,
};

export type EmailClientPublic = Omit<EmailClientConfig, "smtpPasswordEncrypted"> & {
  hasPassword: boolean;
  passwordMasked: string;
};

export const PASSWORD_MASK = "••••••••••";
