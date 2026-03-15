import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAddendumSchema } from "@/lib/validations/lease";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leaseId } = await params;

  try {
    const lease = await db.lease.findFirst({
      where: { id: leaseId, landlordId: session.user.id },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createAddendumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const result = await db.$transaction(async (tx) => {
      // Create the addendum
      const addendum = await tx.leaseAddendum.create({
        data: {
          leaseId,
          type: data.type,
          newRentAmount: data.newRentAmount ?? null,
          newEndDate: data.newEndDate ? new Date(data.newEndDate) : null,
          notes: data.notes || null,
          documentUrl: data.documentUrl || null,
        },
      });

      if (data.type === "RENEWAL") {
        // Mark current lease as RENEWED
        await tx.lease.update({
          where: { id: leaseId },
          data: { status: "RENEWED" },
        });

        // Create a new ACTIVE lease for the renewal period
        const newStartDate = data.newEndDate
          ? lease.endDate
          : lease.endDate;
        const newEndDate = data.newEndDate
          ? new Date(data.newEndDate)
          : new Date(
              new Date(lease.endDate).setFullYear(
                new Date(lease.endDate).getFullYear() + 1
              )
            );
        const newRent = data.newRentAmount ?? Number(lease.rentAmount);

        const newLease = await tx.lease.create({
          data: {
            tenantId: lease.tenantId,
            unitId: lease.unitId,
            propertyId: lease.propertyId,
            landlordId: lease.landlordId,
            startDate: newStartDate,
            endDate: newEndDate,
            rentAmount: newRent,
            documentUrl: data.documentUrl || null,
            notes: data.notes || null,
          },
        });

        // Sync tenant profile dates
        await tx.tenantProfile.update({
          where: { id: lease.tenantId },
          data: {
            leaseStart: newStartDate,
            leaseEnd: newEndDate,
          },
        });

        // Sync unit rent if changed
        if (data.newRentAmount && data.newRentAmount !== Number(lease.rentAmount)) {
          await tx.unit.update({
            where: { id: lease.unitId },
            data: { rentAmount: data.newRentAmount },
          });
        }

        return { addendum, newLease };
      }

      if (data.type === "TERMINATION") {
        const terminationDate = data.newEndDate
          ? new Date(data.newEndDate)
          : new Date();

        await tx.lease.update({
          where: { id: leaseId },
          data: {
            status: "TERMINATED",
            endDate: terminationDate,
          },
        });

        // Sync tenant profile
        await tx.tenantProfile.update({
          where: { id: lease.tenantId },
          data: { leaseEnd: terminationDate },
        });

        return { addendum };
      }

      if (data.type === "AMENDMENT") {
        const updates: Record<string, unknown> = {};
        if (data.newRentAmount !== undefined) updates.rentAmount = data.newRentAmount;
        if (data.newEndDate) updates.endDate = new Date(data.newEndDate);

        if (Object.keys(updates).length > 0) {
          await tx.lease.update({
            where: { id: leaseId },
            data: updates,
          });
        }

        // Sync unit rent if changed
        if (data.newRentAmount && data.newRentAmount !== Number(lease.rentAmount)) {
          await tx.unit.update({
            where: { id: lease.unitId },
            data: { rentAmount: data.newRentAmount },
          });
        }

        // Sync tenant profile dates if end date changed
        if (data.newEndDate) {
          await tx.tenantProfile.update({
            where: { id: lease.tenantId },
            data: { leaseEnd: new Date(data.newEndDate) },
          });
        }

        return { addendum };
      }

      return { addendum };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/leases/[id]/addendum error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
