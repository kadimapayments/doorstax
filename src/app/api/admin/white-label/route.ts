import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const partners = await db.whiteLabelPartner.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
      },
    });

    return NextResponse.json(partners);
  } catch (error) {
    console.error("GET /api/admin/white-label error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      slug,
      customDomain,
      logoUrl,
      faviconUrl,
      primaryColor,
      accentColor,
      platformFeeShare,
      monthlyFee,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existingSlug = await db.whiteLabelPartner.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      return NextResponse.json(
        { error: "A partner with this slug already exists" },
        { status: 409 }
      );
    }

    // Check for duplicate custom domain if provided
    if (customDomain) {
      const existingDomain = await db.whiteLabelPartner.findUnique({
        where: { customDomain },
      });
      if (existingDomain) {
        return NextResponse.json(
          { error: "A partner with this domain already exists" },
          { status: 409 }
        );
      }
    }

    const partner = await db.whiteLabelPartner.create({
      data: {
        name,
        slug,
        customDomain: customDomain || null,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
        primaryColor: primaryColor || "#5B00FF",
        accentColor: accentColor || "#BDA2FF",
        platformFeeShare: platformFeeShare ?? 0.6,
        monthlyFee: monthlyFee ?? 0,
      },
    });

    return NextResponse.json(partner);
  } catch (error) {
    console.error("POST /api/admin/white-label error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
