import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    const lotId = searchParams.get("lotId");
    const status = searchParams.get("status");
    const tenantId = searchParams.get("tenantId");
    const unitId = searchParams.get("unitId");

    const spaceFilter: Prisma.ParkingSpaceWhereInput = {
      lot: {
        property: {
          landlordId: session.user.id,
          ...(propertyId ? { id: propertyId } : {}),
        },
        ...(lotId ? { id: lotId } : {}),
      },
    };

    const where: Prisma.ParkingAssignmentWhereInput = {
      space: spaceFilter,
    };
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;
    if (unitId) where.unitId = unitId;

    const assignments = await db.parkingAssignment.findMany({
      where,
      include: {
        space: {
          include: {
            lot: { select: { id: true, name: true, type: true, propertyId: true, property: { select: { name: true } } } },
          },
        },
        tenant: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch (err) {
    console.error("[parking/assignments] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      spaceId,
      unitId,
      tenantId,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      licensePlate,
      licensePlateState,
      isIncluded,
      monthlyCharge,
      expiresAt,
      chargeStartDate,
      notes,
      splitBilling,
      splits,
    } = body;

    // Validate splits if provided
    if (splitBilling && Array.isArray(splits) && splits.length > 0) {
      const totalPct = splits.reduce(
        (s: number, sp: { percentage: number }) => s + sp.percentage,
        0
      );
      if (Math.abs(totalPct - 100) > 0.01) {
        return NextResponse.json(
          { error: "Split percentages must total 100%" },
          { status: 400 }
        );
      }
    }

    if (!spaceId) {
      return NextResponse.json({ error: "spaceId is required" }, { status: 400 });
    }

    // Verify space belongs to PM
    const space = await db.parkingSpace.findFirst({
      where: {
        id: spaceId,
        lot: { property: { landlordId: session.user.id } },
      },
      include: {
        lot: { select: { id: true, name: true, propertyId: true } },
      },
    });
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Check if space is already assigned
    const existing = await db.parkingAssignment.findFirst({
      where: { spaceId, status: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Space is already assigned" },
        { status: 400 }
      );
    }

    const assignment = await db.parkingAssignment.create({
      data: {
        spaceId,
        unitId: unitId || null,
        tenantId: tenantId || null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleYear: vehicleYear || null,
        vehicleColor: vehicleColor || null,
        licensePlate: licensePlate || null,
        licensePlateState: licensePlateState || null,
        isIncluded: isIncluded !== false,
        monthlyCharge: Number(monthlyCharge) || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        chargeStartDate: chargeStartDate ? new Date(chargeStartDate) : new Date(),
        notes: notes || null,
        assignedById: session.user.id,
      },
      include: {
        space: { include: { lot: true } },
        tenant: { include: { user: { select: { name: true } } } },
        unit: { select: { unitNumber: true } },
      },
    });

    // Handle split billing: create a pending FEE payment for each roommate
    if (
      splitBilling &&
      Array.isArray(splits) &&
      splits.length > 0 &&
      !isIncluded &&
      Number(monthlyCharge) > 0 &&
      unitId
    ) {
      try {
        const firstOfNextMonth = new Date();
        firstOfNextMonth.setMonth(firstOfNextMonth.getMonth() + 1, 1);
        firstOfNextMonth.setHours(0, 0, 0, 0);

        for (const split of splits as Array<{
          tenantId: string;
          percentage: number;
          amount: number;
        }>) {
          if (!split.tenantId || split.amount <= 0) continue;
          await db.payment.create({
            data: {
              tenantId: split.tenantId,
              unitId,
              landlordId: session.user.id,
              amount: split.amount,
              type: "FEE",
              status: "PENDING",
              description: `Parking \u2014 Space ${space.number} (${split.percentage}% share)`,
              dueDate: firstOfNextMonth,
            },
          });
        }
      } catch (err) {
        console.error("[parking] Split billing creation failed:", err);
      }
    }

    // Create journal entry for parking revenue if charged
    if (!assignment.isIncluded && assignment.monthlyCharge > 0) {
      try {
        const { seedDefaultAccounts } = await import("@/lib/accounting/chart-of-accounts");
        await seedDefaultAccounts(session.user.id);
        const { createJournalEntry } = await import("@/lib/accounting/journal-engine");
        await createJournalEntry({
          pmId: session.user.id,
          date: new Date(),
          memo: `Parking assigned \u2014 Space ${space.number}`,
          type: "AUTO",
          source: "PARKING_FEE",
          sourceId: assignment.id,
          propertyId: space.lot.propertyId,
          lines: [
            {
              accountCode: "1100",
              debit: assignment.monthlyCharge,
              memo: "Parking receivable",
              tenantId: assignment.tenantId || undefined,
            },
            {
              accountCode: "4600",
              credit: assignment.monthlyCharge,
              memo: "Parking income",
              propertyId: space.lot.propertyId,
            },
          ],
        }).catch((e) => console.error("[accounting] Parking journal failed:", e));
      } catch (e) {
        console.error("[accounting] Parking trigger error:", e);
      }
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error("[parking/assignments] POST error:", err);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
