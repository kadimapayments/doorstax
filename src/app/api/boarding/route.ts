import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { syncKadimaBoarding } from "@/lib/kadima/lead";
import { COMPLIANCE_WINDOW_DAYS } from "@/lib/constants";
import { completeOnboardingMilestone } from "@/lib/onboarding";

// GET: fetch current application
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let app = await db.merchantApplication.findUnique({
    where: { userId: session.user.id },
    include: { principals: { orderBy: { createdAt: "asc" } }, feeSchedule: true },
  });

  // Fallback: if no MerchantApplication exists (e.g. Kadima lead failed at
  // registration), auto-create one so onboarding can proceed
  if (!app) {
    app = await db.merchantApplication.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, status: "NOT_STARTED" },
      update: {},
      include: { principals: true, feeSchedule: true },
    });
  }

  return NextResponse.json(app);
}

// POST: create or update application (saves per step)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
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

    // Check if application window has expired
    if (existing && existing.createdAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince > COMPLIANCE_WINDOW_DAYS && existing.status !== "SUBMITTED" && existing.status !== "APPROVED") {
        return NextResponse.json(
          { error: `Your ${COMPLIANCE_WINDOW_DAYS}-day application window has expired. Please contact support.` },
          { status: 403 }
        );
      }
    }

    // Validate EIN if provided (must be exactly 9 digits)
    if (data.ein !== undefined && data.ein !== "") {
      const einDigits = String(data.ein).replace(/\D/g, "");
      if (einDigits.length !== 9) {
        return NextResponse.json(
          { error: "EIN must be exactly 9 digits" },
          { status: 400 }
        );
      }
      data.ein = einDigits;
    }

    // Extract principals array (step 3) before mapping to DB fields
    const principalsData: Array<{
      firstName: string;
      lastName: string;
      title?: string;
      dob?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      ownershipPercent?: number;
      isManager?: boolean;
      ssn?: string;
      driversLicense?: string;
      driversLicenseExp?: string;
      email?: string;
      phone?: string;
    }> = Array.isArray(data.principals) ? data.principals : [];
    delete data.principals;

    // Map step data to DB fields
    const updateData: Record<string, unknown> = { ...data };

    // Remove feeSchedule from updateData (handled separately)
    delete updateData.feeSchedule;

    // Convert string values to proper types for Prisma
    const intFields = [
      "ownershipPercent",
      "numberOfBuildings",
      "numberOfUnits",
      "salesMethodInPerson",
      "salesMethodMailPhone",
      "salesMethodEcommerce",
      "customerProfileConsumer",
      "customerProfileBusiness",
      "customerProfileGovernment",
      "customerLocationLocal",
      "customerLocationNational",
      "customerLocationInternational",
      "yearsInBusiness",
    ];
    for (const field of intFields) {
      if (updateData[field] !== undefined && updateData[field] !== "") {
        updateData[field] = parseInt(String(updateData[field]), 10);
        if (isNaN(updateData[field] as number)) delete updateData[field];
      } else if (updateData[field] === "") {
        delete updateData[field];
      }
    }

    const decimalFields = ["monthlyVolume", "averageTransaction", "maxTransactionAmount", "amexMonthlyVolume"];
    for (const field of decimalFields) {
      if (updateData[field] !== undefined && updateData[field] !== "") {
        updateData[field] = parseFloat(String(updateData[field]));
        if (isNaN(updateData[field] as number)) delete updateData[field];
      } else if (updateData[field] === "") {
        delete updateData[field];
      }
    }

    const boolFields = ["currentlyProcessCards", "everTerminated", "acceptVisa", "acceptAmex", "acceptPinDebit", "acceptEbt", "amexOptOut", "hasRetailLocation", "isSeasonal"];
    for (const field of boolFields) {
      if (updateData[field] !== undefined) {
        if (updateData[field] === "true" || updateData[field] === true) updateData[field] = true;
        else if (updateData[field] === "false" || updateData[field] === false) updateData[field] = false;
        else delete updateData[field];
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
    updateData.status = step === 7 ? "SUBMITTED" : "IN_PROGRESS";

    // Guided Launch Mode: mark merchant app as started on first step
    if (step === 1) {
      completeOnboardingMilestone(session.user.id, "merchantStarted").catch(console.error);
    }

    if (step === 7) {
      updateData.completedAt = new Date();
      // Mark the manager as active upon full submission + clear suspension
      await db.user.update({
        where: { id: session.user.id },
        data: { managerStatus: "ACTIVE", suspendedAt: null },
      });
    }

    if (existing) {
      const updated = await db.merchantApplication.update({
        where: { userId: session.user.id },
        data: updateData,
        include: { principals: { orderBy: { createdAt: "asc" } } },
      });

      // Save principals on step 3+ (upsert to preserve signature data)
      if (step >= 3 && principalsData.length > 0) {
        // Get existing principals to preserve signature fields
        const existingPrincipals = await db.merchantPrincipal.findMany({
          where: { merchantApplicationId: updated.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            signatureBase64: true,
            signedAt: true,
            signedIp: true,
            signedUserAgent: true,
          },
        });

        // Delete existing principals
        await db.merchantPrincipal.deleteMany({
          where: { merchantApplicationId: updated.id },
        });

        // Recreate with signature data preserved by index
        await db.merchantPrincipal.createMany({
          data: principalsData.map((p, idx) => {
            const preserved = existingPrincipals[idx];
            return {
              merchantApplicationId: updated.id,
              firstName: p.firstName,
              lastName: p.lastName,
              title: p.title || null,
              dob: p.dob ? new Date(p.dob) : null,
              address: p.address || null,
              city: p.city || null,
              state: p.state || null,
              zip: p.zip || null,
              ownershipPercent: p.ownershipPercent != null ? parseInt(String(p.ownershipPercent), 10) : null,
              isManager: p.isManager === true,
              ssn: p.ssn || null,
              driversLicense: p.driversLicense || null,
              driversLicenseExp: p.driversLicenseExp || null,
              email: p.email || null,
              phone: p.phone || null,
              // Preserve signature data from previous save
              ...(preserved?.signatureBase64 ? { signatureBase64: preserved.signatureBase64 } : {}),
              ...(preserved?.signedAt ? { signedAt: preserved.signedAt } : {}),
              ...(preserved?.signedIp ? { signedIp: preserved.signedIp } : {}),
              ...(preserved?.signedUserAgent ? { signedUserAgent: preserved.signedUserAgent } : {}),
            };
          }),
        });
      }

      // Sync to Kadima on final submission
      if (step === 7 && updated.kadimaAppId) {
        const withPrincipals = await db.merchantApplication.findUnique({
          where: { id: updated.id },
          include: { principals: true },
        });
        syncKadimaBoarding(withPrincipals ?? updated).catch((err: unknown) =>
          console.error("[kadima-boarding] Sync failed:", err)
        );
      }

      // Re-fetch with principals to return fresh data
      const result = await db.merchantApplication.findUnique({
        where: { id: updated.id },
        include: { principals: { orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json(result);
    } else {
      const created = await db.merchantApplication.create({
        data: {
          userId: session.user.id,
          ...updateData,
        },
        include: { principals: true },
      });

      // Save principals if provided
      if (principalsData.length > 0) {
        await db.merchantPrincipal.createMany({
          data: principalsData.map((p) => ({
            merchantApplicationId: created.id,
            firstName: p.firstName,
            lastName: p.lastName,
            title: p.title || null,
            dob: p.dob ? new Date(p.dob) : null,
            address: p.address || null,
            city: p.city || null,
            state: p.state || null,
            zip: p.zip || null,
            ownershipPercent: p.ownershipPercent != null ? parseInt(String(p.ownershipPercent), 10) : null,
            isManager: p.isManager === true,
            ssn: p.ssn || null,
            driversLicense: p.driversLicense || null,
            driversLicenseExp: p.driversLicenseExp || null,
            email: p.email || null,
            phone: p.phone || null,
          })),
        });
      }

      // Sync to Kadima on final submission
      if (step === 7 && created.kadimaAppId) {
        syncKadimaBoarding(created).catch((err: unknown) =>
          console.error("[kadima-boarding] Sync failed:", err)
        );
      }

      const result = await db.merchantApplication.findUnique({
        where: { id: created.id },
        include: { principals: { orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json(result, { status: 201 });
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
