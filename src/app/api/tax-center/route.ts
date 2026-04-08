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

  // Get vendor records with expense totals via relation
  const vendors = await db.vendor.findMany({
    where: { landlordId },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      w9Status: true,
      w9DocumentUrl: true,
      taxId: true,
      taxIdType: true,
      expenses: {
        where: {
          date: { gte: yearStart, lt: yearEnd },
          status: { notIn: ["WRITTEN_OFF"] },
        },
        select: { amount: true },
      },
    },
  });

  const vendorData = vendors.map((v) => {
    const totalPaid = v.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      id: v.id,
      name: v.name,
      company: v.company,
      email: v.email,
      phone: v.phone,
      w9Status: v.w9Status || "NOT_REQUESTED",
      w9DocumentUrl: v.w9DocumentUrl,
      hasTaxId: !!v.taxId,
      taxId: v.taxId ? `***-**-${v.taxId.slice(-4)}` : null,
      taxIdType: v.taxIdType,
      totalPaid: Math.round(totalPaid * 100) / 100,
      requires1099: totalPaid >= 600,
    };
  });

  // Property income report
  const properties = await db.property.findMany({
    where: { landlordId },
    select: {
      id: true,
      name: true,
      address: true,
      units: {
        select: {
          id: true,
          payments: {
            where: {
              status: "COMPLETED",
              paidAt: { gte: yearStart, lt: yearEnd },
            },
            select: { amount: true, type: true, surchargeAmount: true },
          },
        },
      },
      expenses: {
        where: {
          date: { gte: yearStart, lt: yearEnd },
          status: { notIn: ["WRITTEN_OFF"] },
        },
        select: { amount: true },
      },
    },
  });

  const propertyIncome = properties.map((p) => {
    const allPayments = p.units.flatMap((u) => u.payments);
    const grossRent = allPayments.filter((pay) => pay.type === "RENT").reduce((s, pay) => s + Number(pay.amount), 0);
    const feeIncome = allPayments.filter((pay) => pay.type === "FEE").reduce((s, pay) => s + Number(pay.amount), 0);
    const surcharges = allPayments.reduce((s, pay) => s + Number(pay.surchargeAmount || 0), 0);
    const totalExpenses = p.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      unitCount: p.units.length,
      grossRent: Math.round(grossRent * 100) / 100,
      feeIncome: Math.round(feeIncome * 100) / 100,
      surcharges: Math.round(surcharges * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netIncome: Math.round((grossRent + feeIncome - totalExpenses) * 100) / 100,
    };
  });

  // Summary
  const totalDisbursements = ownerData.reduce((s, o) => s + o.totalNetPayout, 0);
  const ownersAboveThreshold = ownerData.filter((o) => o.totalNetPayout >= 600).length;
  const vendorsAboveThreshold = vendorData.filter((v) => v.totalPaid >= 600).length;
  const totalGrossIncome = propertyIncome.reduce((s, p) => s + p.grossRent + p.feeIncome, 0);
  const totalNetIncome = propertyIncome.reduce((s, p) => s + p.netIncome, 0);

  return NextResponse.json({
    year,
    owners: ownerData,
    vendors: vendorData,
    propertyIncome,
    summary: {
      totalDisbursements: Math.round(totalDisbursements * 100) / 100,
      totalOwners: ownerData.length,
      ownersAboveThreshold,
      vendorsAboveThreshold,
      totalGrossIncome: Math.round(totalGrossIncome * 100) / 100,
      totalNetIncome: Math.round(totalNetIncome * 100) / 100,
    },
  });
}
