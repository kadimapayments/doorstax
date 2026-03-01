import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/kadima/webhooks";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-kadima-signature") || "";

  // Verify HMAC-SHA256 signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    const event = parseWebhookEvent(rawBody);

    // Map Kadima webhook events to payment status updates
    switch (event.event) {
      case "ach.completed":
      case "transaction.completed": {
        const transactionId = event.data.id;
        if (transactionId) {
          await db.payment.updateMany({
            where: { kadimaTransactionId: transactionId },
            data: {
              status: "COMPLETED",
              kadimaStatus: event.data.status,
              paidAt: new Date(),
            },
          });
        }
        break;
      }

      case "ach.failed":
      case "transaction.failed": {
        const transactionId = event.data.id;
        if (transactionId) {
          await db.payment.updateMany({
            where: { kadimaTransactionId: transactionId },
            data: {
              status: "FAILED",
              kadimaStatus: event.data.status,
            },
          });
        }
        break;
      }

      case "ach.returned":
      case "transaction.refunded": {
        const transactionId = event.data.id;
        if (transactionId) {
          await db.payment.updateMany({
            where: { kadimaTransactionId: transactionId },
            data: {
              status: "REFUNDED",
              kadimaStatus: event.data.status,
            },
          });
        }
        break;
      }

      case "recurring.processed": {
        // A recurring payment was auto-charged — create a local payment record
        if (event.data.customerId && event.data.amount) {
          const profile = await db.tenantProfile.findFirst({
            where: { kadimaCustomerId: event.data.customerId },
            include: { unit: { include: { property: true } } },
          });

          if (profile && profile.unit) {
            await db.payment.create({
              data: {
                tenantId: profile.id,
                unitId: profile.unit.id,
                landlordId: profile.unit.property.landlordId,
                amount: event.data.amount,
                type: "RENT",
                status: "COMPLETED",
                paymentMethod: "ach",
                kadimaTransactionId: event.data.id,
                kadimaStatus: event.data.status,
                dueDate: new Date(),
                paidAt: new Date(),
              },
            });
          }
        }
        break;
      }

      default:
        // Log unhandled event types
        console.log(`Unhandled Kadima webhook event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
