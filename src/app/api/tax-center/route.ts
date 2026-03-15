import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  // Get all owners for this landlord
  const owners = await db.owner.findMany({
    where: { landlordId },
    include: {
      payouts: {
        where: {
          periodStart: { gte: yearStart },
          periodEnd: { lt: yearEnd },
          status: "PAID",
        },
        select: {
          grossRent: true,
          processingFees: true,
          managementFee: true,
          expenses: true,
          platformFee: true,
          payoutFee: true,
          unitFee: true,
          netPayout: true,
        },
      },
      documents: {
        where: {
          type: "TAX_DOC",
          period: String(year),
        },
        select: { id: true },
      },
    },
  });

  const ownerData = owners.map((owner) => {
    const totalGrossRent = owner.payouts.reduce(
      (s, p) => s + Number(p.grossRent),
      0
    );
    const totalFees = owner.payouts.reduce(
      (s, p) =>
        s +
        Number(p.processingFees) +
        Number(p.managementFee) +
        Number(p.expenses) +
        Number(p.platformFee) +
        Number(p.payoutFee) +
        Number(p.unitFee),
      0
    );
    const totalNetPayout = owner.payouts.reduce(
      (s, p) => s + Number(p.netPayout),
      0
    );

    return {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      taxId: owner.taxId
        ? `***-**-${owner.taxId.slice(-4)}`
        : null,
      taxIdType: owner.taxIdType,
      hasTaxId: !!owner.taxId,
      totalGrossRent: Math.round(totalGrossRent * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      totalNetPayout: Math.round(totalNetPayout * 100) / 100,
      payoutCount: owner.payouts.length,
      has1099: owner.documents.length > 0,
    };
  });

  // Get vendor expense totals for the year
  const expenses = await db.expense.findMany({
    where: {
      landlordId,
      date: { gte: yearStart, lt: yearEnd },
    },
    select: { vendor: true, amount: true },
  });

  // Aggregate by vendor name
  const vendorTotals = new Map<string, number>();
  for (const exp of expenses) {
    if (exp.vendor) {
      vendorTotals.set(
        exp.vendor,
        (vendorTotals.get(exp.vendor) || 0) + Number(exp.amount)
      );
    }
  }

  // Get vendor records
  const vendors = await db.vendor.findMany({
    where: { landlordId },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      w9Status: true,
      taxId: true,
      taxIdType: true,
    },
  });

  const vendorData = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    company: v.company,
    email: v.email,
    w9Status: v.w9Status,
    hasTaxId: !!v.taxId,
    totalPaid: Math.round((vendorTotals.get(v.name) || 0) * 100) / 100,
  }));

  // Summary
  const totalDisbursements = ownerData.reduce((s, o) => s + o.totalNetPayout, 0);
  const ownersAboveThreshold = ownerData.filter((o) => o.totalNetPayout >= 600).length;
  const vendorsAboveThreshold = vendorData.filter((v) => v.totalPaid >= 600).length;

  return NextResponse.json({
    year,
    owners: ownerData,
    vendors: vendorData,
    summary: {
      totalDisbursements: Math.round(totalDisbursements * 100) / 100,
      totalOwners: ownerData.length,
      ownersAboveThreshold,
      vendorsAboveThreshold,
    },
  });
}
