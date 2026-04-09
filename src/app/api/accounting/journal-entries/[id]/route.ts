import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reverseJournalEntry } from "@/lib/accounting/journal-engine";

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
    const entry = await db.journalEntry.findFirst({
      where: { id, pmId: session.user.id },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true, type: true } } },
        },
        property: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entry);
  } catch (err) {
    console.error("[accounting/journal-entries/:id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.action === "reverse") {
      const reversal = await reverseJournalEntry(session.user.id, id, body.memo);
      return NextResponse.json(reversal);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[accounting/journal-entries/:id] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 }
    );
  }
}
