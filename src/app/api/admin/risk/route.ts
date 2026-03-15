import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:risk")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const paymentId = req.nextUrl.searchParams.get("paymentId");

  if (paymentId) {
    // Return enriched detail for a single payment
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        tenant: { include: { user: { select: { name: true, email: true } } } },
        unit: { include: { property: { include: { landlord: { select: { name: true, email: true } } } } } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get tenant's last 10 payments
    const tenantHistory = await db.payment.findMany({
      where: { tenantId: payment.tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        paymentMethod: true,
      },
    });

    return NextResponse.json({
      id: payment.id,
      amount: Number(payment.amount),
      surchargeAmount: payment.surchargeAmount ? Number(payment.surchargeAmount) : null,
      paymentMethod: payment.paymentMethod,
      cardBrand: payment.cardBrand,
      cardLast4: payment.cardLast4,
      achLast4: payment.achLast4,
      status: payment.status,
      type: payment.type,
      description: payment.description,
      dueDate: payment.dueDate.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      tenant: { name: payment.tenant.user.name, email: payment.tenant.user.email },
      landlord: { name: payment.unit.property.landlord.name, email: payment.unit.property.landlord.email },
      property: {
        name: payment.unit.property.name,
        address: payment.unit.property.address,
        city: payment.unit.property.city,
        state: payment.unit.property.state,
        zip: payment.unit.property.zip,
      },
      unit: payment.unit.unitNumber,
      tenantHistory: tenantHistory.map((h) => ({
        id: h.id,
        amount: Number(h.amount),
        status: h.status,
        date: h.createdAt.toISOString(),
        paymentMethod: h.paymentMethod,
      })),
    });
  }

  return NextResponse.json({ error: "paymentId required" }, { status: 400 });
}
