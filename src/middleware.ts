import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/login", "/register", "/listings", "/apply", "/landlords", "/managers", "/tenants", "/terms", "/privacy", "/invite", "/forgot-password", "/reset-password", "/coming-soon"];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  // Hostname-based routing: doorstax.com shows the coming-soon landing page
  const hostname = req.nextUrl.hostname;
  if (
    (hostname === "doorstax.com" || hostname === "www.doorstax.com") &&
    pathname === "/"
  ) {
    return NextResponse.rewrite(new URL("/coming-soon", req.url));
  }

  // Allow public paths
  if (isPublicPath(pathname)) return NextResponse.next();

  // Allow API auth routes
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // Allow public API routes (applications, listings)
  if (pathname.startsWith("/api/applications") && req.method === "POST")
    return NextResponse.next();
  if (pathname.startsWith("/api/listings") && req.method === "GET")
    return NextResponse.next();

  // Allow webhook endpoints
  if (pathname.startsWith("/api/webhooks")) return NextResponse.next();

  // Allow lead API (public form submission)
  if (pathname.startsWith("/api/lead") && req.method === "POST")
    return NextResponse.next();

  // Allow tenant invite accept (unauthenticated — tenant sets password here)
  if (pathname === "/api/tenants/invite/accept" && req.method === "POST")
    return NextResponse.next();

  // Redirect unauthenticated users
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Helper: read impersonation type from cookies (supports both new and legacy formats)
  function getImpersonationType(): string | null {
    // New cookie format (set by /api/impersonate)
    const meta = req.cookies.get("impersonation_meta")?.value;
    if (meta) {
      try {
        return JSON.parse(meta).type || null;
      } catch {
        // Invalid cookie
      }
    }
    // Legacy cookie format
    const legacy = req.cookies.get("impersonating")?.value;
    if (legacy) {
      try {
        return JSON.parse(legacy).type || null;
      } catch {
        // Invalid cookie
      }
    }
    return null;
  }

  const impersonationType = getImpersonationType();

  // Role-based route protection
  if (pathname.startsWith("/dashboard") && user.role !== "PM") {
    // Allow admins who are impersonating a landlord
    if (user.role === "ADMIN" && impersonationType === "landlord") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/tenant") && user.role !== "TENANT") {
    // Allow landlords who are impersonating a tenant
    if (user.role === "PM" && impersonationType === "tenant") {
      return NextResponse.next();
    }
    // Allow admins who are impersonating a tenant
    if (user.role === "ADMIN" && impersonationType === "tenant") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/owner") && user.role !== "OWNER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/partner") && user.role !== "PARTNER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.webp$).*)"],
};
