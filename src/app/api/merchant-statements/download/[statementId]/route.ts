import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadStatement } from "@/lib/kadima/reporting";
import { getMerchantCredentials } from "@/lib/kadima/merchant-context";

export async function GET(
  _req: Request,
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
    const creds = await getMerchantCredentials(session.user.id);
    const pdfBuffer = await downloadStatement(statementId, creds.apiKey);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="DoorStax_Statement_${statementId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[merchant-statements/download] error:", err);
    return NextResponse.json(
      { error: "Failed to download statement" },
      { status: 500 }
    );
  }
}
