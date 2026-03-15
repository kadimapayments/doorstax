import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await db.owner.findFirst({ where: { userId: session.user.id } });
  if (!owner) return NextResponse.json({ error: "Owner profile not found" }, { status: 404 });

  const documents = await db.ownerDocument.findMany({
    where: { ownerId: owner.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    documents.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      type: d.type,
      period: d.period,
      createdAt: d.createdAt,
    }))
  );
}
