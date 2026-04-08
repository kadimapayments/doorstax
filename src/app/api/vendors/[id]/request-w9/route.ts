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
    select: { id: true, name: true, email: true, w9Status: true },
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
    data: { w9Status: "REQUESTED" },
  });

  // Send W-9 request email
  try {
    const { emailStyles, emailHeader, emailFooter } = await import("@/lib/emails/_layout");
    const { getResend } = await import("@/lib/email");
    const resend = getResend();

    const pmUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, companyName: true, email: true },
    });

    const companyName = pmUser?.companyName || "DoorStax";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
<div class="container"><div class="card">
${emailHeader()}
<h1>W-9 Request</h1>
<p>Hi ${vendor.name},</p>
<p><strong>${companyName}</strong> is requesting a completed W-9 form for tax reporting purposes.</p>
<p>As a vendor who has provided services, we are required to collect your W-9 information for potential 1099-NEC filing with the IRS.</p>
<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
<p style="font-size:13px;color:#555;margin:0 0 8px 0;"><strong>What to do:</strong></p>
<ol style="font-size:13px;color:#555;margin:0;padding-left:20px;">
<li>Download a blank W-9 from <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf">IRS.gov</a></li>
<li>Complete and sign the form</li>
<li>Reply to this email with the completed W-9 attached</li>
</ol></div>
<p style="font-size:12px;color:#888;">If you have already submitted a W-9, please disregard this message.
For questions, contact ${pmUser?.name || "your property manager"} at ${pmUser?.email || ""}.</p>
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
