import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdminPermission("admin:landlords");
  const { id } = await params;

  try {
    const body = await req.json();

    // Only allow specific fields to be updated
    const allowed = [
      "name", "email", "phone", "companyName", "managerStatus",
      "kadimaMerchantApiKey", "kadimaMerchantWebhookSecret", "kadimaMerchantTerminalId",
    ];
    const data: Record<string, string | null> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key] === "" ? null : body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Verify user exists and is a LANDLORD
    const existing = await db.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!existing || existing.role !== "PM") {
      return NextResponse.json(
        { error: "Manager not found" },
        { status: 404 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        managerStatus: true,
        kadimaMerchantApiKey: true,
        kadimaMerchantWebhookSecret: true,
        kadimaMerchantTerminalId: true,
      },
    });

    // Mask sensitive keys in response (show only last 6 chars)
    const mask = (val: string | null) =>
      val ? `${"*".repeat(Math.max(0, val.length - 6))}${val.slice(-6)}` : null;

    return NextResponse.json({
      ...updated,
      kadimaMerchantApiKey: mask(updated.kadimaMerchantApiKey),
      kadimaMerchantWebhookSecret: mask(updated.kadimaMerchantWebhookSecret),
      // Terminal ID is not sensitive — return as-is
    });
  } catch (error) {
    console.error("PATCH /api/admin/landlords/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
