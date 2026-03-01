import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateHostedFieldsToken } from "@/lib/kadima/hosted-fields";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TENANT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await generateHostedFieldsToken();
    return NextResponse.json(token);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate payment token" },
      { status: 500 }
    );
  }
}
