import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateHostedFieldsToken } from "@/lib/kadima/hosted-fields";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["TENANT", "PM", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Accept domain from client so the token matches the browser's actual origin
    let domain: string | undefined;
    try {
      const body = await req.json();
      domain = body.domain;
    } catch {
      // No body is fine — will use server default
    }

    const tokenData = await generateHostedFieldsToken({ saveCard: "required" }, undefined, domain);
    // Map access_token → token for the frontend
    return NextResponse.json({ token: tokenData.access_token });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate payment token" },
      { status: 500 }
    );
  }
}
