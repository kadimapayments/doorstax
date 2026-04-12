import { NextRequest, NextResponse } from "next/server";

/**
 * Admin impersonation now uses the main /api/impersonate endpoint.
 * This stub redirects or returns a helpful error.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (userId) {
    // Redirect to the page-based impersonation start
    return NextResponse.redirect(
      new URL(`/admin/impersonate/${userId}`, req.url)
    );
  }
  return NextResponse.json(
    { error: "Use POST /api/impersonate with { landlordId } instead" },
    { status: 400 }
  );
}
