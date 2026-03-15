import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE: Revoke an API key
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const key = await db.apiKey.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if (key.revokedAt) {
    return NextResponse.json({ error: "API key already revoked" }, { status: 400 });
  }

  await db.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
