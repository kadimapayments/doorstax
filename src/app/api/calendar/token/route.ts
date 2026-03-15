import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

// GET — list active calendar tokens for current user
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await db.calendarToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { id: true, label: true, token: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

// POST — generate new calendar feed token
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label = "Default";
  try {
    const body = await req.json();
    if (body.label) label = String(body.label).slice(0, 100);
  } catch {
    // use default label
  }

  const token = crypto.randomUUID();

  const created = await db.calendarToken.create({
    data: {
      userId: session.user.id,
      token,
      label,
    },
    select: { id: true, label: true, token: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}

// DELETE — revoke a token
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tokenId = searchParams.get("id");

  if (!tokenId) {
    return NextResponse.json({ error: "Token id required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await db.calendarToken.findFirst({
    where: { id: tokenId, userId: session.user.id, revokedAt: null },
  });

  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await db.calendarToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
