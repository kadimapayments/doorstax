export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Vendor self-serve profile.
 * GET — returns the vendor's User fields + a category summary across all PM Vendor records.
 * PATCH — updates name, phone, companyName. Email changes require admin (safety).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
    },
  });
  const vendorRows = await db.vendor.findMany({
    where: { userId: session.user.id },
    select: { category: true },
  });
  const categories = Array.from(
    new Set(vendorRows.map((v) => v.category).filter(Boolean))
  );
  return NextResponse.json({ user, categories, pmCount: vendorRows.length });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, phone, companyName } = body as {
    name?: string;
    phone?: string;
    companyName?: string;
  };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim() || null;
  if (phone !== undefined) data.phone = phone.trim() || null;
  if (companyName !== undefined)
    data.companyName = companyName.trim() || null;

  const updated = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { name: true, email: true, phone: true, companyName: true },
  });
  return NextResponse.json({ ok: true, user: updated });
}
