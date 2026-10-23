import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/access/routes";
import { AUTH_COOKIE_NAME } from "@/lib/authCookie";

interface JwtPayload {
  userId?: number;
  email?: string;
  roleId?: number;
  roleName?: string;
  permissions?: string[];
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    let jsonStr = "";
    if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(base64, "base64").toString("utf8");
    } else {
      jsonStr = atob(base64);
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/m") ||
    pathname.startsWith("/attendance");

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // Allow unauthorized error page
  if (pathname === "/dashboard/unauthorized") {
    return NextResponse.next();
  }

  const token =
    request.cookies.get(AUTH_COOKIE_NAME)?.value ||
    request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwt(token);

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    response.cookies.delete("token");
    return response;
  }

  const roleName = (payload.roleName || "").toLowerCase().trim();
  const isEmployee = roleName === "employee" || roleName === "karyawan";

  // If Employee tries to access desktop admin dashboard, redirect to Mobile PWA
  if (isEmployee && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/m/beranda", request.url));
  }

  if (pathname.startsWith("/dashboard")) {
    const hasAccess = canAccessRoute(pathname, {
      roleName: payload.roleName,
      permissions: payload.permissions,
    });

    if (!hasAccess) {
      const unauthorizedUrl = new URL("/dashboard/unauthorized", request.url);
      unauthorizedUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/m/:path*",
    "/m",
    "/attendance/:path*",
    "/attendance",
  ],
};
