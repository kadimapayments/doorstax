import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const account = await db.ledgerAccount.findFirst({
      where: { id, pmId: session.user.id },
      include: {
        journalLines: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            journalEntry: { select: { entryNumber: true, date: true, memo: true, type: true, source: true } },
          },
        },
      },
    });

    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(account);
  } catch (err) {
    console.error("[accounting/accounts/:id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const account = await db.ledgerAccount.findFirst({
      where: { id, pmId: session.user.id },
    });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const updated = await db.ledgerAccount.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.code !== undefined && { code: body.code || null }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[accounting/accounts/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
