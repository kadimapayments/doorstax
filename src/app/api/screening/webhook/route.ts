import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhook, mapRentSpreeStatus } from "@/lib/rentspree";
import { notify } from "@/lib/notifications";
import { screeningCompleteHtml } from "@/lib/emails/screening-complete";

/**
 * RentSpree webhook endpoint.
 * Called when screening status changes (e.g., completed, expired).
 * No auth — verification done via HMAC signature.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-rentspree-signature") || "";

    // Verify webhook signature
    if (signature && !verifyWebhook(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const {
      screening_request_id,
      screeningRequestId,
      status,
      credit_score,
      creditScore,
      credit_result,
      creditResult,
      criminal_result,
      criminalResult,
      eviction_result,
      evictionResult,
    } = payload;

    const rsId = screening_request_id || screeningRequestId;
    if (!rsId) {
      return NextResponse.json({ error: "Missing screening request ID" }, { status: 400 });
    }

    // Find the screening record by RentSpree ID
    const screening = await db.tenantScreening.findUnique({
      where: { rentspreeId: rsId },
      include: {
        landlord: { select: { id: true, name: true, email: true } },
        application: { select: { name: true, unit: { select: { property: { select: { name: true } } } } } },
      },
    });

    if (!screening) {
      // Not found — could be from another system, ignore gracefully
      return NextResponse.json({ received: true, matched: false });
    }

    const newStatus = mapRentSpreeStatus(status);
    const score = credit_score ?? creditScore;
    const cResult = credit_result ?? creditResult;
    const crResult = criminal_result ?? criminalResult;
    const eResult = eviction_result ?? evictionResult;

    await db.tenantScreening.update({
      where: { rentspreeId: rsId },
      data: {
        status: newStatus,
        creditScore: score != null ? Number(score) : screening.creditScore,
        creditResult: cResult ?? screening.creditResult,
        criminalResult: crResult ?? screening.criminalResult,
        evictionResult: eResult ?? screening.evictionResult,
        completedAt: newStatus === "COMPLETED" ? new Date() : screening.completedAt,
      },
    });

    // Notify PM when screening completes
    if (newStatus === "COMPLETED" && screening.landlord) {
      const pm = screening.landlord;
      const applicantName = screening.application?.name || "Applicant";
      const propertyName = screening.application?.unit?.property?.name || "your property";

      notify({
        userId: pm.id,
        createdById: pm.id,
        type: "SCREENING_COMPLETE",
        title: "Screening Results Ready",
        message: `Tenant screening for ${applicantName} (${propertyName}) is complete.`,
        severity: "info",
        email: pm.email ? {
          to: pm.email,
          subject: `Screening Complete — ${applicantName}`,
          html: screeningCompleteHtml({ pmName: pm.name || "Property Manager", applicantName, propertyName }),
        } : undefined,
      }).catch(console.error);
    }

    return NextResponse.json({ received: true, matched: true, status: newStatus });
  } catch (e) {
    console.error("Screening webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
