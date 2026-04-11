import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "PM" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the template belongs to this PM
  const template = await db.applicationTemplate.findFirst({
    where: { id, landlordId: session.user.id },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Unset all other defaults in a transaction with setting this one
  await db.$transaction([
    db.applicationTemplate.updateMany({
      where: {
        landlordId: session.user.id,
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    }),
    db.applicationTemplate.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
