import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET: fetch current application
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.merchantApplication.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(app);
}

// POST: create or update application (saves per step)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { step, data } = body;

    if (!step || !data) {
      return NextResponse.json(
        { error: "Step and data are required" },
        { status: 400 }
      );
    }

    const existing = await db.merchantApplication.findUnique({
      where: { userId: session.user.id },
    });

    // Map step data to DB fields
    const updateData: Record<string, unknown> = { ...data };

    // Convert string values to proper types for Prisma
    const intFields = ["ownershipPercent", "numberOfBuildings", "numberOfUnits"];
    for (const field of intFields) {
      if (updateData[field] !== undefined && updateData[field] !== "") {
        updateData[field] = parseInt(String(updateData[field]), 10);
        if (isNaN(updateData[field] as number)) delete updateData[field];
      } else if (updateData[field] === "") {
        delete updateData[field];
      }
    }

    const decimalFields = ["monthlyVolume", "averageTransaction"];
    for (const field of decimalFields) {
      if (updateData[field] !== undefined && updateData[field] !== "") {
        updateData[field] = parseFloat(String(updateData[field]));
        if (isNaN(updateData[field] as number)) delete updateData[field];
      } else if (updateData[field] === "") {
        delete updateData[field];
      }
    }

    // Convert principalDob string to DateTime if present
    if (updateData.principalDob && typeof updateData.principalDob === "string") {
      const dob = new Date(updateData.principalDob as string);
      if (isNaN(dob.getTime())) {
        delete updateData.principalDob;
      } else {
        updateData.principalDob = dob;
      }
    }

    // Set current step and status
    updateData.currentStep = Math.max(step, existing?.currentStep || 1);
    updateData.status = step === 5 ? "SUBMITTED" : "IN_PROGRESS";

    if (step === 5) {
      updateData.completedAt = new Date();
    }

    if (existing) {
      const updated = await db.merchantApplication.update({
        where: { userId: session.user.id },
        data: updateData,
      });
      return NextResponse.json(updated);
    } else {
      const created = await db.merchantApplication.create({
        data: {
          userId: session.user.id,
          ...updateData,
        },
      });
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Boarding API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
