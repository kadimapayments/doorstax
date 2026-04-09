import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createJournalEntry } from "@/lib/accounting/journal-engine";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const source = searchParams.get("source");
    const type = searchParams.get("type");
    const propertyId = searchParams.get("propertyId");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Number(searchParams.get("limit") || 50));

    const where: Prisma.JournalEntryWhereInput = { pmId: session.user.id };
    if (period) where.period = period;
    if (source) where.source = source;
    if (type) where.type = type;
    if (propertyId) where.propertyId = propertyId;

    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        orderBy: [{ date: "desc" }, { entryNumber: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true, type: true } } },
          },
          property: { select: { name: true } },
        },
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({ entries, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[accounting/journal-entries] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { date, memo, lines, propertyId } = body;

    if (!date || !memo || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json({ error: "date, memo, and at least 2 lines required" }, { status: 400 });
    }

    const entry = await createJournalEntry({
      pmId: session.user.id,
      date: new Date(date),
      memo,
      type: "MANUAL",
      source: "MANUAL",
      propertyId: propertyId || undefined,
      lines,
      createdById: session.user.id,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[accounting/journal-entries] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create entry" },
      { status: 400 }
    );
  }
}
