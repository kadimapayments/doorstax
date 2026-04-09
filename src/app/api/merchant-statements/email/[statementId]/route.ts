import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadStatement } from "@/lib/kadima/reporting";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";
import { getResend } from "@/lib/email";
import { merchantStatementEmail } from "@/lib/emails/merchant-statement";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ statementId: string }> }
) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { statementId } = await params;

    // Get PM info
    const pm = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    if (!pm) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const creds = await getMerchantCredentials(session.user.id);
    const pdfBuffer = await downloadStatement(statementId, creds.apiKey);

    // Derive a period label from the statement ID (often formatted as YYYY-MM or similar)
    const periodLabel = statementId.replace(/-/g, " ").replace(/_/g, " ");

    const html = merchantStatementEmail({
      pmName: pm.name,
      statementDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      periodLabel,
    });

    const resend = getResend();
    await resend.emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: pm.email,
      subject: "Your Merchant Statement \u2014 " + periodLabel,
      html,
      attachments: [
        {
          filename: "Merchant_Statement_" + statementId + ".pdf",
          content: Buffer.from(pdfBuffer),
        },
      ],
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[merchant-statements/email] error:", err);
    return NextResponse.json(
      { error: "Failed to email statement" },
      { status: 500 }
    );
  }
}
