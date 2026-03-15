import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCardToken } from "@/lib/kadima/hosted-fields";

/**
 * POST /api/payments/hosted-card-token
 *
 * After a successful hosted-fields card submission (submit.result with result: true),
 * call this endpoint with the access token to retrieve the tokenized card.
 *
 * Kadima docs: POST /hosted-fields/card-token { accessToken }
 * Returns: { token, bin, exp, number }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["TENANT", "PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string | undefined;
  try {
    const body = await req.json();
    accessToken = (body as { accessToken: string }).accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken is required" },
        { status: 400 }
      );
    }

    const cardData = await getCardToken(accessToken);
    console.log("[hosted-card-token] Success:", JSON.stringify(cardData));
    return NextResponse.json(cardData);
  } catch (err: any) {
    // Log the full error details from Kadima
    const axiosData = err?.response?.data;
    const axiosStatus = err?.response?.status;
    console.error("[hosted-card-token] Error:", {
      message: err?.message,
      status: axiosStatus,
      data: JSON.stringify(axiosData),
      accessTokenPrefix: accessToken?.substring(0, 20) + "...",
    });
    return NextResponse.json(
      { error: "Failed to retrieve card token", detail: axiosData?.error || axiosData?.message || err?.message },
      { status: 500 }
    );
  }
}
