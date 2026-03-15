import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";

export async function POST() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // QuickBooks OAuth2 requires QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET env vars
  if (!process.env.QUICKBOOKS_CLIENT_ID) {
    return NextResponse.json(
      { error: "QuickBooks integration is not yet configured. Check back soon!" },
      { status: 503 }
    );
  }

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.QUICKBOOKS_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    process.env.NEXT_PUBLIC_APP_URL + "/api/integrations/quickbooks/callback"
  )}&response_type=code&scope=com.intuit.quickbooks.accounting&state=${session.user.id}`;

  return NextResponse.json({ authUrl });
}
