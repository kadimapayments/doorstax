import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/register", "/listings", "/apply"];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

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

  // Redirect unauthenticated users
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  if (pathname.startsWith("/dashboard") && user.role !== "LANDLORD") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/tenant") && user.role !== "TENANT") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
