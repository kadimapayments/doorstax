import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        screeningCreditReport: true,
        screeningCriminal: true,
        screeningEviction: true,
        screeningApplication: true,
        screeningPayerType: true,
      },
    });

    return NextResponse.json(
      user || {
        screeningCreditReport: true,
        screeningCriminal: true,
        screeningEviction: true,
        screeningApplication: true,
        screeningPayerType: "landlord",
      }
    );
  } catch (err) {
    console.error("[rentspree/screening-defaults] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch defaults" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      (session.user.role !== "PM" && session.user.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Validate with enforcement rules
    const creditReport = body.screeningCreditReport === true;
    const criminal = creditReport ? body.screeningCriminal === true : false;
    const eviction = creditReport ? body.screeningEviction === true : false;
    const application = creditReport
      ? body.screeningApplication === true
      : true;
    const payerType =
      body.screeningPayerType === "renter" ? "renter" : "landlord";

    // At least one option must be true
    if (!creditReport && !application) {
      return NextResponse.json(
        { error: "At least credit report or application must be enabled" },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        screeningCreditReport: creditReport,
        screeningCriminal: criminal,
        screeningEviction: eviction,
        screeningApplication: application,
        screeningPayerType: payerType,
      },
      select: {
        screeningCreditReport: true,
        screeningCriminal: true,
        screeningEviction: true,
        screeningApplication: true,
        screeningPayerType: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[rentspree/screening-defaults] PUT error:", err);
    return NextResponse.json(
      { error: "Failed to update defaults" },
      { status: 500 }
    );
  }
}
