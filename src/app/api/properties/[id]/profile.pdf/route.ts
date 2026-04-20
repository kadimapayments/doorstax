import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { generatePropertyProfilePdf } from "@/lib/property-profile-pdf";

/**
 * GET /api/properties/[id]/profile.pdf
 *
 * DoorStax-branded property profile PDF for underwriter review.
 *
 * Authorization:
 *   - The PM that owns the property can always download.
 *   - Any admin with `admin:landlords` or `admin:payments` can download.
 *   - Anyone else → 403.
 *
 * Returns application/pdf with a Content-Disposition attachment filename.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const property = await db.property.findUnique({
    where: { id },
    select: { id: true, landlordId: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Access check: PM owns it, or admin has oversight permission.
  let authorized = property.landlordId === session.user.id;
  if (!authorized && session.user.role === "ADMIN") {
    const adminCtx = await getAdminContext(session.user.id);
    authorized =
      canAdmin(adminCtx, "admin:landlords") ||
      canAdmin(adminCtx, "admin:payments");
  }
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { buffer, filename } = await generatePropertyProfilePdf(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[property-profile.pdf] generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
