import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { createPropertySchema } from "@/lib/validations/property";
import { syncSubscriptionAmount } from "@/lib/subscription";
import { completeOnboardingMilestone } from "@/lib/onboarding";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const properties = await db.property.findMany({
    where: { landlordId },
    include: {
      units: {
        select: {
          id: true,
          unitNumber: true,
          rentAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(properties);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createPropertySchema.parse(body);

    const property = await db.property.create({
      data: {
        ...data,
        landlordId: session.user.id,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
    });

    // Sync subscription billing after property creation
    await syncSubscriptionAmount(session.user.id).catch(() => {});

    // Guided Launch Mode: mark property milestone
    completeOnboardingMilestone(session.user.id, "propertyAdded").catch(console.error);

    // Terminal provisioning signal: if PM has an approved/submitted merchant
    // app, create a dashboard notice so the team knows a Kadima terminal
    // needs to be assigned to this new property.
    try {
      const merchantApp = await db.merchantApplication.findUnique({
        where: { userId: session.user.id },
        select: { status: true, kadimaAppId: true },
      });
      if (
        merchantApp &&
        (merchantApp.status === "APPROVED" || merchantApp.status === "SUBMITTED")
      ) {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: session.user.id,
          createdById: session.user.id,
          type: "TERMINAL_REQUEST",
          title: "Terminal assignment pending",
          message: `Property "${property.name}" was created and needs a Kadima terminal. Admin will provision shortly.`,
          severity: "warning",
          actionUrl: `/dashboard/properties/${property.id}`,
        }).catch((e) =>
          console.error("[properties] terminal notify failed:", e)
        );
      }
    } catch (e) {
      console.error("[properties] terminal request failed:", e);
    }

    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
