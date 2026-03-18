import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAcquiringAgreementPdf } from "@/lib/acquiring-agreement-pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;
  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "true";

  const app = await db.merchantApplication.findUnique({
    where: { userId },
    include: {
      principals: { orderBy: { createdAt: "asc" } },
      feeSchedule: true,
    },
  });

  if (!app) {
    return NextResponse.json(
      { error: "No merchant application found for this user" },
      { status: 404 }
    );
  }

  try {
    const pdfBuffer = await generateAcquiringAgreementPdf(app as Parameters<typeof generateAcquiringAgreementPdf>[0]);

    const dba = app.dba || app.businessLegalName || "Merchant";
    const filename = `${dba.replace(/[^a-zA-Z0-9]/g, "-")}-Application.pdf`;
    const disposition = download
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin-agreement] PDF generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate agreement PDF" },
      { status: 500 }
    );
  }
}
