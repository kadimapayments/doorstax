import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import { generateAcquiringAgreementPdf, type AgreementData, type PrincipalData, type FeeScheduleData } from "@/lib/acquiring-agreement-pdf";
import { generateSignatureDetailsPdf, type SignatureAuditData, type SignerAuditEntry } from "@/lib/signature-details-pdf";
import { getResend } from "@/lib/email";
import { acquiringAgreementEmail } from "@/lib/emails/acquiring-agreement";

// ─── Helpers ────────────────────────────────────────

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function buildAgreementData(
  app: {
    id: string;
    [key: string]: unknown;
    principals: Array<{
      id: string;
      firstName: string;
      lastName: string;
      title: string | null;
      dob: Date | null;
      ssn: string | null;
      driversLicense: string | null;
      driversLicenseExp: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      ownershipPercent: number | null;
      isManager: boolean;
      signatureBase64: string | null;
      signedAt: Date | null;
    }>;
    feeSchedule: {
      interchangePlusRate: unknown;
      qualifiedRate: unknown;
      midQualSurcharge: unknown;
      nonQualSurcharge: unknown;
      rateType: string | null;
      visaMcDiscoverRate: unknown;
      offlineDebitRate: unknown;
      amexOptBlueRate: unknown;
      authorizationFee: unknown;
      transactionFee: unknown;
      monthlyDashboardFee: unknown;
      voiceAuthFee: unknown;
      monthlyMinimumFee: unknown;
      applicationFee: unknown;
      batchFee: unknown;
      chargebackFee: unknown;
      retrievalFee: unknown;
      avsTransactionFee: unknown;
      monthlyFee: unknown;
      annualFee: unknown;
      monthlyPciFee: unknown;
      specialNotes: string | null;
    } | null;
  }
): AgreementData {
  const principals: PrincipalData[] = app.principals.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    title: p.title,
    dob: p.dob,
    ssn: p.ssn,
    driversLicense: p.driversLicense,
    driversLicenseExp: p.driversLicenseExp,
    email: p.email,
    phone: p.phone,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    ownershipPercent: p.ownershipPercent,
    isManager: p.isManager,
    signatureBase64: p.signatureBase64,
    signedAt: p.signedAt,
  }));

  let feeSchedule: FeeScheduleData | null = null;
  if (app.feeSchedule) {
    const fs = app.feeSchedule;
    feeSchedule = {
      interchangePlusRate: toNumber(fs.interchangePlusRate),
      qualifiedRate: toNumber(fs.qualifiedRate),
      midQualSurcharge: toNumber(fs.midQualSurcharge),
      nonQualSurcharge: toNumber(fs.nonQualSurcharge),
      rateType: fs.rateType,
      visaMcDiscoverRate: toNumber(fs.visaMcDiscoverRate),
      offlineDebitRate: toNumber(fs.offlineDebitRate),
      amexOptBlueRate: toNumber(fs.amexOptBlueRate),
      authorizationFee: toNumber(fs.authorizationFee),
      transactionFee: toNumber(fs.transactionFee),
      monthlyDashboardFee: toNumber(fs.monthlyDashboardFee),
      voiceAuthFee: toNumber(fs.voiceAuthFee),
      monthlyMinimumFee: toNumber(fs.monthlyMinimumFee),
      applicationFee: toNumber(fs.applicationFee),
      batchFee: toNumber(fs.batchFee),
      chargebackFee: toNumber(fs.chargebackFee),
      retrievalFee: toNumber(fs.retrievalFee),
      avsTransactionFee: toNumber(fs.avsTransactionFee),
      monthlyFee: toNumber(fs.monthlyFee),
      annualFee: toNumber(fs.annualFee),
      monthlyPciFee: toNumber(fs.monthlyPciFee),
      specialNotes: fs.specialNotes,
    };
  }

  return {
    id: app.id,
    businessLegalName: app.businessLegalName as string | null,
    dba: app.dba as string | null,
    businessType: app.businessType as string | null,
    ein: app.ein as string | null,
    businessAddress: app.businessAddress as string | null,
    businessCity: app.businessCity as string | null,
    businessState: app.businessState as string | null,
    businessZip: app.businessZip as string | null,
    businessPhone: app.businessPhone as string | null,
    businessEmail: app.businessEmail as string | null,
    websiteUrl: app.websiteUrl as string | null,
    yearsInBusiness: app.yearsInBusiness as number | null,
    stockSymbol: app.stockSymbol as string | null,
    faxNumber: app.faxNumber as string | null,
    mccCode: app.mccCode as string | null,
    productDescription: app.productDescription as string | null,
    numberOfBuildings: app.numberOfBuildings as number | null,
    numberOfUnits: app.numberOfUnits as number | null,
    monthlyVolume: toNumber(app.monthlyVolume),
    averageTransaction: toNumber(app.averageTransaction),
    maxTransactionAmount: toNumber(app.maxTransactionAmount),
    amexMonthlyVolume: toNumber(app.amexMonthlyVolume),
    buildingType: app.buildingType as string | null,
    merchantOwnsOrRents: app.merchantOwnsOrRents as string | null,
    areaZoned: app.areaZoned as string | null,
    squareFootage: app.squareFootage as string | null,
    bankruptcyHistory: app.bankruptcyHistory as string | null,
    bankruptcyExplanation: app.bankruptcyExplanation as string | null,
    currentlyProcessCards: app.currentlyProcessCards as boolean | null,
    currentProcessor: app.currentProcessor as string | null,
    everTerminated: app.everTerminated as boolean | null,
    terminatedExplanation: app.terminatedExplanation as string | null,
    acceptVisa: app.acceptVisa as boolean,
    acceptAmex: app.acceptAmex as boolean,
    acceptPinDebit: app.acceptPinDebit as boolean,
    acceptEbt: app.acceptEbt as boolean,
    amexOptOut: app.amexOptOut as boolean,
    salesMethodInPerson: app.salesMethodInPerson as number | null,
    salesMethodMailPhone: app.salesMethodMailPhone as number | null,
    salesMethodEcommerce: app.salesMethodEcommerce as number | null,
    bankRoutingNumber: app.bankRoutingNumber as string | null,
    bankAccountNumber: app.bankAccountNumber as string | null,
    bankAccountUsage: app.bankAccountUsage as string | null,
    refundPolicy: app.refundPolicy as string | null,
    equipmentUsed: app.equipmentUsed as string | null,
    recurringServices: app.recurringServices as string | null,
    customerProfileConsumer: app.customerProfileConsumer as number | null,
    customerProfileBusiness: app.customerProfileBusiness as number | null,
    customerProfileGovernment: app.customerProfileGovernment as number | null,
    customerLocationLocal: app.customerLocationLocal as number | null,
    customerLocationNational: app.customerLocationNational as number | null,
    customerLocationInternational: app.customerLocationInternational as number | null,
    fulfillmentTiming: app.fulfillmentTiming as string | null,
    deliveryTiming: app.deliveryTiming as string | null,
    chargedAt: app.chargedAt as string | null,
    hasRetailLocation: app.hasRetailLocation as boolean | null,
    retailLocationAddress: app.retailLocationAddress as string | null,
    advertisingMethods: app.advertisingMethods as string | null,
    isSeasonal: app.isSeasonal as boolean | null,
    seasonalMonths: app.seasonalMonths as string | null,
    principals,
    feeSchedule,
  };
}

// ─── GET: Generate unsigned agreement preview ───────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const app = await db.merchantApplication.findUnique({
      where: { userId: session.user.id },
      include: {
        principals: { orderBy: { createdAt: "asc" } },
        feeSchedule: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const agreementData = buildAgreementData(app as Parameters<typeof buildAgreementData>[0]);
    const pdfBuffer = await generateAcquiringAgreementPdf(agreementData);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="agreement-v1.8-preview.pdf"`,
      },
    });
  } catch (err) {
    console.error("Agreement PDF preview error:", err);
    return NextResponse.json({ error: "Failed to generate agreement PDF" }, { status: 500 });
  }
}

// ─── POST: Sign the agreement ───────────────────────

interface SignatureInput {
  principalId: string;
  signatureBase64: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { signatures, userAgent } = body as {
      signatures: SignatureInput[];
      userAgent: string;
    };

    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return NextResponse.json({ error: "At least one signature is required" }, { status: 400 });
    }

    // Capture IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Fetch the application
    const app = await db.merchantApplication.findUnique({
      where: { userId: session.user.id },
      include: {
        principals: { orderBy: { createdAt: "asc" } },
        feeSchedule: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (app.agreementSignedAt) {
      return NextResponse.json({ error: "Agreement already signed" }, { status: 409 });
    }

    // Validate all signature principalIds exist
    const principalIds = new Set(app.principals.map((p) => p.id));
    for (const sig of signatures) {
      if (!principalIds.has(sig.principalId)) {
        return NextResponse.json(
          { error: `Principal ${sig.principalId} not found on this application` },
          { status: 400 }
        );
      }
    }

    // Update each principal with signature data
    const now = new Date();
    for (const sig of signatures) {
      await db.merchantPrincipal.update({
        where: { id: sig.principalId },
        data: {
          signatureBase64: sig.signatureBase64,
          signedAt: now,
          signedIp: ip,
          signedUserAgent: userAgent || "unknown",
        },
      });
    }

    // Re-fetch with updated signatures
    const updatedApp = await db.merchantApplication.findUnique({
      where: { id: app.id },
      include: {
        principals: { orderBy: { createdAt: "asc" } },
        feeSchedule: true,
      },
    });

    if (!updatedApp) {
      return NextResponse.json({ error: "Application not found after update" }, { status: 500 });
    }

    // Generate signed agreement PDF
    const agreementData = buildAgreementData(updatedApp as Parameters<typeof buildAgreementData>[0]);
    const agreementPdfBuffer = await generateAcquiringAgreementPdf(agreementData);

    // Compute SHA-256 hash of the agreement PDF
    const hash = createHash("sha256").update(agreementPdfBuffer).digest("hex");

    // Build signature audit data
    const signers: SignerAuditEntry[] = updatedApp.principals
      .filter((p) => p.signedAt)
      .map((p) => ({
        name: `${p.firstName} ${p.lastName}`,
        title: p.title,
        ownershipPercent: p.ownershipPercent,
        signedAt: p.signedAt!.toISOString(),
        ip: p.signedIp || "unknown",
        userAgent: p.signedUserAgent || "unknown",
        signatureBase64: p.signatureBase64,
      }));

    const auditData: SignatureAuditData = {
      merchantName: updatedApp.businessLegalName || "N/A",
      dba: updatedApp.dba,
      applicationId: updatedApp.id,
      applicationDate: updatedApp.createdAt.toISOString().split("T")[0],
      signers,
      agreementPdfHash: hash,
      generatedAt: new Date().toISOString(),
    };

    const signatureDetailsPdfBuffer = await generateSignatureDetailsPdf(auditData);

    // Upload both PDFs to Vercel Blob
    const [agreementBlob, detailsBlob] = await Promise.all([
      put(`agreements/${updatedApp.id}/agreement.pdf`, agreementPdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      }),
      put(`agreements/${updatedApp.id}/signature-details.pdf`, signatureDetailsPdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      }),
    ]);

    // Update application with PDF URLs and signed timestamp
    await db.merchantApplication.update({
      where: { id: updatedApp.id },
      data: {
        agreementPdfUrl: agreementBlob.url,
        signatureDetailsPdfUrl: detailsBlob.url,
        agreementSignedAt: now,
      },
    });

    // Send email with both PDFs attached
    try {
      const resend = getResend();
      const signedAt = now.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      const html = acquiringAgreementEmail({
        merchantName: updatedApp.businessLegalName || "N/A",
        dba: updatedApp.dba || "N/A",
        signedAt,
        principalCount: signers.length,
      });

      const toAddresses: string[] = [];
      // Send to business email
      if (updatedApp.businessEmail) {
        toAddresses.push(updatedApp.businessEmail);
      }
      // Also send to each principal's email
      for (const p of updatedApp.principals) {
        if (p.email && !toAddresses.includes(p.email)) {
          toAddresses.push(p.email);
        }
      }

      if (toAddresses.length > 0) {
        await resend.emails.send({
          from: "DoorStax <noreply@doorstax.com>",
          to: toAddresses,
          subject: "NEW DOORSTAX APPLICATION SUBMITTED",
          html,
          attachments: [
            {
              filename: "Merchant-Agreement-V1.8.pdf",
              content: agreementPdfBuffer.toString("base64"),
            },
            {
              filename: "Signature-Audit-Trail.pdf",
              content: signatureDetailsPdfBuffer.toString("base64"),
            },
          ],
        });
      }
    } catch (emailErr) {
      // Log but don't fail the request if email fails
      console.error("Failed to send agreement email:", emailErr);
    }

    return NextResponse.json({
      success: true,
      agreementPdfUrl: agreementBlob.url,
      signatureDetailsPdfUrl: detailsBlob.url,
    });
  } catch (err) {
    console.error("Agreement signing error:", err);
    return NextResponse.json({ error: "Failed to sign agreement" }, { status: 500 });
  }
}
