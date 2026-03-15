import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateHostedFieldsToken } from "@/lib/kadima/hosted-fields";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["TENANT", "PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Accept domain + saveCard from client
    const body = await req.json().catch(() => ({}));
    const { domain, saveCard } = body as {
      domain?: string;
      saveCard?: "required" | "optional" | "disabled";
    };

    // Pass saveCard when provided by the client (e.g. "required" for save-card flows)
    const tokenData = await generateHostedFieldsToken(
      saveCard ? { saveCard } : undefined,
      undefined,
      domain
    );
    // Map access_token → token for the frontend
    return NextResponse.json({ token: tokenData.access_token });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate payment token" },
      { status: 500 }
    );
  }
}
