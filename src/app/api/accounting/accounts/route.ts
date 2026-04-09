import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDefaultAccounts } from "@/lib/accounting/chart-of-accounts";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await seedDefaultAccounts(session.user.id);

    const accounts = await db.ledgerAccount.findMany({
      where: { pmId: session.user.id },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      include: { property: { select: { name: true } } },
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error("[accounting/accounts] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { code, name, type, subType, description, normalBalance, parentId, propertyId } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 });
    }

    const account = await db.ledgerAccount.create({
      data: {
        pmId: session.user.id,
        code: code || null,
        name,
        type,
        subType: subType || null,
        description: description || null,
        normalBalance: normalBalance || (["ASSET", "EXPENSE"].includes(type) ? "DEBIT" : "CREDIT"),
        parentId: parentId || null,
        propertyId: propertyId || null,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error("[accounting/accounts] POST error:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
