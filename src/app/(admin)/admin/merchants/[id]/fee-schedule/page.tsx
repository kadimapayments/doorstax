import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeeScheduleForm } from "./fee-schedule-form";

export const metadata = { title: "Fee Schedule — Admin" };

export default async function AdminMerchantFeeSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const merchantApp = await db.merchantApplication.findUnique({
    where: { id },
    include: {
      feeSchedule: true,
      user: { select: { name: true, companyName: true } },
    },
  });

  if (!merchantApp) notFound();

  const displayName =
    merchantApp.dba ||
    merchantApp.businessLegalName ||
    merchantApp.user.companyName ||
    merchantApp.user.name;

  // Serialize Decimal fields to number | null for the client component
  const feeSchedule = merchantApp.feeSchedule
    ? {
        id: merchantApp.feeSchedule.id,
        interchangePlusRate: merchantApp.feeSchedule.interchangePlusRate
          ? Number(merchantApp.feeSchedule.interchangePlusRate)
          : null,
        qualifiedRate: merchantApp.feeSchedule.qualifiedRate
          ? Number(merchantApp.feeSchedule.qualifiedRate)
          : null,
        midQualSurcharge: merchantApp.feeSchedule.midQualSurcharge
          ? Number(merchantApp.feeSchedule.midQualSurcharge)
          : null,
        nonQualSurcharge: merchantApp.feeSchedule.nonQualSurcharge
          ? Number(merchantApp.feeSchedule.nonQualSurcharge)
          : null,
        rateType: merchantApp.feeSchedule.rateType,
        visaMcDiscoverRate: merchantApp.feeSchedule.visaMcDiscoverRate
          ? Number(merchantApp.feeSchedule.visaMcDiscoverRate)
          : null,
        offlineDebitRate: merchantApp.feeSchedule.offlineDebitRate
          ? Number(merchantApp.feeSchedule.offlineDebitRate)
          : null,
        amexOptBlueRate: merchantApp.feeSchedule.amexOptBlueRate
          ? Number(merchantApp.feeSchedule.amexOptBlueRate)
          : null,
        authorizationFee: merchantApp.feeSchedule.authorizationFee
          ? Number(merchantApp.feeSchedule.authorizationFee)
          : null,
        transactionFee: merchantApp.feeSchedule.transactionFee
          ? Number(merchantApp.feeSchedule.transactionFee)
          : null,
        monthlyDashboardFee: merchantApp.feeSchedule.monthlyDashboardFee
          ? Number(merchantApp.feeSchedule.monthlyDashboardFee)
          : null,
        voiceAuthFee: merchantApp.feeSchedule.voiceAuthFee
          ? Number(merchantApp.feeSchedule.voiceAuthFee)
          : null,
        monthlyMinimumFee: merchantApp.feeSchedule.monthlyMinimumFee
          ? Number(merchantApp.feeSchedule.monthlyMinimumFee)
          : null,
        applicationFee: merchantApp.feeSchedule.applicationFee
          ? Number(merchantApp.feeSchedule.applicationFee)
          : null,
        batchFee: merchantApp.feeSchedule.batchFee
          ? Number(merchantApp.feeSchedule.batchFee)
          : null,
        chargebackFee: merchantApp.feeSchedule.chargebackFee
          ? Number(merchantApp.feeSchedule.chargebackFee)
          : null,
        retrievalFee: merchantApp.feeSchedule.retrievalFee
          ? Number(merchantApp.feeSchedule.retrievalFee)
          : null,
        avsTransactionFee: merchantApp.feeSchedule.avsTransactionFee
          ? Number(merchantApp.feeSchedule.avsTransactionFee)
          : null,
        monthlyFee: merchantApp.feeSchedule.monthlyFee
          ? Number(merchantApp.feeSchedule.monthlyFee)
          : null,
        annualFee: merchantApp.feeSchedule.annualFee
          ? Number(merchantApp.feeSchedule.annualFee)
          : null,
        monthlyPciFee: merchantApp.feeSchedule.monthlyPciFee
          ? Number(merchantApp.feeSchedule.monthlyPciFee)
          : null,
        specialNotes: merchantApp.feeSchedule.specialNotes,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/landlords/${merchantApp.userId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Merchant
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Fee Schedule"
        description={`Managing fees for ${displayName}`}
      />

      <FeeScheduleForm
        merchantApplicationId={id}
        initialData={feeSchedule}
      />
    </div>
  );
}
