import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCustomer, addCard, listCards, deleteCard } from "@/lib/kadima/customer-vault";

/**
 * GET /api/pm-card — Get PM's card on file info
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        kadimaCustomerId: true,
        kadimaCardTokenId: true,
        pmCardBrand: true,
        pmCardLast4: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasCard: !!(user.kadimaCardTokenId),
      cardBrand: user.pmCardBrand,
      cardLast4: user.pmCardLast4,
      customerId: user.kadimaCustomerId,
    });
  } catch (error) {
    console.error("GET /api/pm-card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/pm-card — Save PM's card details after hosted fields completion
 * Body: { customerId, cardId, cardBrand, cardLast4 }
 *
 * If no Kadima customer exists, create one first.
 * The frontend (hosted fields) will handle the actual card tokenization;
 * this endpoint just stores the vault references.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { customerId, cardId, cardBrand, cardLast4 } = body;

    if (!customerId || !cardId) {
      return NextResponse.json(
        { error: "customerId and cardId are required" },
        { status: 400 }
      );
    }

    // Save the card info on the User record
    await db.user.update({
      where: { id: session.user.id },
      data: {
        kadimaCustomerId: customerId,
        kadimaCardTokenId: cardId,
        pmCardBrand: cardBrand || null,
        pmCardLast4: cardLast4 || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/pm-card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/pm-card — Remove PM's card on file
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { kadimaCustomerId: true, kadimaCardTokenId: true },
    });

    // Try to delete from Kadima vault if IDs exist
    if (user?.kadimaCustomerId && user?.kadimaCardTokenId) {
      try {
        await deleteCard(user.kadimaCustomerId, user.kadimaCardTokenId);
      } catch {
        // If remote deletion fails, still clear local record
        console.warn("Failed to delete card from Kadima vault");
      }
    }

    // Clear local record
    await db.user.update({
      where: { id: session.user.id },
      data: {
        kadimaCardTokenId: null,
        pmCardBrand: null,
        pmCardLast4: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/pm-card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PUT /api/pm-card — Create a Kadima customer for the PM (if needed)
 * Returns the customerId to use with hosted fields
 */
export async function PUT() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        kadimaCustomerId: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If already has a customerId, return it
    if (user.kadimaCustomerId) {
      return NextResponse.json({ customerId: user.kadimaCustomerId });
    }

    // Create a new Kadima customer
    const nameParts = (user.name || "").split(" ");
    const firstName = nameParts[0] || "PM";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const result = await createCustomer({
      firstName,
      lastName,
      email: user.email || "",
      phone: user.phone || undefined,
    });

    const resultAny = result as unknown as Record<string, any>;
    const newCustomerId = resultAny.id != null ? String(resultAny.id) : null;
    if (!newCustomerId) {
      return NextResponse.json(
        { error: "Failed to create Kadima customer" },
        { status: 500 }
      );
    }

    // Save the customerId
    await db.user.update({
      where: { id: session.user.id },
      data: { kadimaCustomerId: newCustomerId },
    });

    return NextResponse.json({ customerId: newCustomerId });
  } catch (error) {
    console.error("PUT /api/pm-card error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
