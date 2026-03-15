import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify partner exists
    const existing = await db.whiteLabelPartner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    // Only allow specific fields to be updated
    const allowed = [
      "name",
      "slug",
      "customDomain",
      "logoUrl",
      "faviconUrl",
      "primaryColor",
      "accentColor",
      "platformFeeShare",
      "monthlyFee",
      "isActive",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
      if (typeof data.slug === "string" && !/^[a-z0-9-]+$/.test(data.slug)) {
        return NextResponse.json(
          { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
          { status: 400 }
        );
      }
      const slugExists = await db.whiteLabelPartner.findUnique({
        where: { slug: data.slug as string },
      });
      if (slugExists) {
        return NextResponse.json(
          { error: "A partner with this slug already exists" },
          { status: 409 }
        );
      }
    }

    // Validate custom domain uniqueness if changing
    if (data.customDomain && data.customDomain !== existing.customDomain) {
      const domainExists = await db.whiteLabelPartner.findUnique({
        where: { customDomain: data.customDomain as string },
      });
      if (domainExists) {
        return NextResponse.json(
          { error: "A partner with this domain already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.whiteLabelPartner.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/white-label/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify partner exists
    const existing = await db.whiteLabelPartner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    // Soft delete: set isActive to false
    const updated = await db.whiteLabelPartner.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("DELETE /api/admin/white-label/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
