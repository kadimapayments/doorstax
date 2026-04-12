import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";

/**
 * GET /api/admin/impersonate?userId=xxx
 *
 * Stub for admin impersonation. Currently redirects to the PM's
 * merchant profile page. Full session impersonation (switching the
 * active NextAuth user) would require a server-side session swap
 * which is a future enhancement.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // For now, redirect to the merchant profile in the admin panel.
  // Full impersonation (session swap) is a future enhancement.
  const { db } = await import("@/lib/db");
  const app = await db.merchantApplication.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (app) {
    return NextResponse.redirect(
      new URL(`/admin/merchants/${app.id}`, req.url)
    );
  }

  return NextResponse.redirect(new URL("/admin/merchants", req.url));
}
