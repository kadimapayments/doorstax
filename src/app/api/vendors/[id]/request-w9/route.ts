import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const { id } = await params;

  const vendor = await db.vendor.findFirst({
    where: { id, landlordId },
    select: { id: true, name: true, email: true, w9Status: true, userId: true },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  if (!vendor.email) {
    return NextResponse.json({ error: "Vendor has no email address" }, { status: 400 });
  }

  // Update W-9 status to REQUESTED
  await db.vendor.update({
    where: { id },
    data: { w9Status: "REQUESTED", w9RequestedAt: new Date() },
  });

  // Send W-9 request email — points to vendor portal if vendor has an account,
  // otherwise includes a signup hint.
  try {
    const { emailStyles, emailHeader, emailFooter, emailButton } = await import(
      "@/lib/emails/_layout"
    );
    const { getResend } = await import("@/lib/email");
    const resend = getResend();

    const pmUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, companyName: true, email: true },
    });

    const companyName = pmUser?.companyName || "DoorStax";
    const BASE_URL =
      process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const portalUrl = `${BASE_URL}/vendor/documents`;
    const loginUrl = `${BASE_URL}/login`;

    const hasAccount = !!vendor.userId;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
<div class="container"><div class="card">
${emailHeader()}
<h1>W-9 Request</h1>
<p>Hi ${vendor.name},</p>
<p><strong>${companyName}</strong> needs a completed W-9 on file before they can pay you more than $600/year (IRS 1099-NEC reporting requirement).</p>
${
  hasAccount
    ? `<p>Upload your signed W-9 in your DoorStax Vendor Portal — takes about a minute.</p>${emailButton("Upload W-9 in Vendor Portal", portalUrl)}`
    : `<p>You don't have a DoorStax Vendor Portal account yet. Ask <strong>${companyName}</strong> to invite you to the portal — they can do it from your vendor profile.</p>${emailButton("Log in if you already have an account", loginUrl)}`
}
<p style="margin-top:16px;font-size:13px;color:#666;">Need a blank W-9? <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" style="color:#5B00FF;">Download from IRS.gov</a>. Once signed, upload it using the button above.</p>
<p style="font-size:12px;color:#888;">For questions, contact ${pmUser?.name || "your property manager"} at ${pmUser?.email || ""}.</p>
</div>${emailFooter()}</div></body></html>`;

    await resend.emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: vendor.email,
      subject: `W-9 Request from ${companyName}`,
      html,
    });
  } catch (err) {
    console.error("[w9-request] Email failed:", err);
  }

  return NextResponse.json({ success: true });
}
