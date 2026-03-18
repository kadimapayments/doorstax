import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ─── Numeric fee fields (parsed as floats) ───────────────────────
const NUMERIC_FIELDS = [
  "interchangePlusRate",
  "qualifiedRate",
  "midQualSurcharge",
  "nonQualSurcharge",
  "visaMcDiscoverRate",
  "offlineDebitRate",
  "amexOptBlueRate",
  "authorizationFee",
  "transactionFee",
  "monthlyDashboardFee",
  "voiceAuthFee",
  "monthlyMinimumFee",
  "applicationFee",
  "batchFee",
  "chargebackFee",
  "retrievalFee",
  "avsTransactionFee",
  "monthlyFee",
  "annualFee",
  "monthlyPciFee",
] as const;

// ─── String fields (kept as-is) ──────────────────────────────────
const STRING_FIELDS = ["rateType", "specialNotes"] as const;

/**
 * GET /api/admin/merchants/[id]/fee-schedule
 * Returns the MerchantFeeSchedule for the given MerchantApplication, or null.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const merchantApp = await db.merchantApplication.findUnique({
      where: { id },
      include: { feeSchedule: true },
    });

    if (!merchantApp) {
      return NextResponse.json(
        { error: "Merchant application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ feeSchedule: merchantApp.feeSchedule ?? null });
  } catch (error) {
    console.error("GET /api/admin/merchants/[id]/fee-schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/merchants/[id]/fee-schedule
 * Create or update the MerchantFeeSchedule for the given MerchantApplication.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the merchant application exists
    const merchantApp = await db.merchantApplication.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!merchantApp) {
      return NextResponse.json(
        { error: "Merchant application not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Build data object — parse numeric fields, keep string fields as-is
    const data: Record<string, number | string | null> = {};

    for (const field of NUMERIC_FIELDS) {
      if (body[field] !== undefined) {
        const val = body[field];
        if (val === null || val === "" || val === undefined) {
          data[field] = null;
        } else {
          const parsed = parseFloat(String(val));
          data[field] = isNaN(parsed) ? null : parsed;
        }
      }
    }

    for (const field of STRING_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field] === "" ? null : body[field];
      }
    }

    // Upsert: create if not exists, update if exists
    const feeSchedule = await db.merchantFeeSchedule.upsert({
      where: { merchantApplicationId: id },
      create: {
        merchantApplicationId: id,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ feeSchedule });
  } catch (error) {
    console.error("PUT /api/admin/merchants/[id]/fee-schedule error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
