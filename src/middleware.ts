import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { STUDENT_INFO_LEGACY_REDIRECTS } from "@/config/student-info";

const SESSION_COOKIE = "gs_session";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login" || pathname === "/forgot-password";
  const isPublic =
    isLogin ||
    pathname.startsWith("/branding") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const key = secret();
  let session: { accountType?: string; sessionRole?: string } | null = null;
  if (token && key) {
    try {
      const { payload } = await jwtVerify(token, key);
      session = payload as { accountType?: string; sessionRole?: string };
    } catch {
      session = null;
    }
  }

  if (!session && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (session && pathname === "/login") {
    if (session.accountType === "PLATFORM") {
      return NextResponse.redirect(new URL("/platform/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/platform")) {
    if (session?.accountType !== "PLATFORM") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const legacyTarget = STUDENT_INFO_LEGACY_REDIRECTS[pathname];
  if (legacyTarget) {
    return NextResponse.redirect(new URL(legacyTarget, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|branding/|uploads/).*)"],
};
