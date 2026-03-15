import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const realmId = searchParams.get("realmId");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard/settings/integrations?error=missing_params", req.url));
  }

  // TODO: Exchange authorization code for access token
  // 1. POST to https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  // 2. Store access_token, refresh_token in Integration model
  // 3. Redirect back to settings page

  try {
    await db.integration.create({
      data: {
        userId: state,
        provider: "QUICKBOOKS",
        accessToken: null, // TODO: store actual token
        refreshToken: null,
        metadata: { realmId, code: "PLACEHOLDER" },
        isActive: false, // Set to true once real tokens are obtained
      },
    });
  } catch (e) {
    console.error("QuickBooks callback error:", e);
  }

  return NextResponse.redirect(new URL("/dashboard/settings/integrations?success=quickbooks", req.url));
}
