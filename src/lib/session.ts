import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { SUPER_ADMIN_EMAIL } from "@/config/branding";

export const SESSION_COOKIE = "gs_session";
export const VIEW_WORKSPACE_COOKIE = "gs_view_workspace";

export type AccountType = "PLATFORM" | "WORKSPACE";
export type SessionRole = "SUPER_ADMIN" | "WORKSPACE_USER";

export type SessionPayload = JWTPayload & {
  sub: string;
  email: string;
  name: string;
  accountType: AccountType;
  sessionRole: SessionRole;
  workspaceId: string | null;
  permissions: string[];
  roleSlugs: string[];
  linkedStudentId?: string | null;
  linkedStudentIds?: string[];
  linkedTeacherId?: string | null;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be a 32+ character secret.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as SessionPayload;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getViewWorkspaceId() {
  const store = await cookies();
  return store.get(VIEW_WORKSPACE_COOKIE)?.value ?? null;
}

export function isPlatformSuperAdmin(session: SessionPayload | null) {
  return (
    !!session &&
    session.accountType === "PLATFORM" &&
    session.sessionRole === "SUPER_ADMIN" &&
    session.workspaceId === null &&
    session.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
