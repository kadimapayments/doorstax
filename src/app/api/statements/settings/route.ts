import { NextResponse } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  const settings = await db.documentSettings.findUnique({
    where: { landlordId },
  });

  return NextResponse.json(
    settings || { primaryColor: "#5B00FF", footerText: null, logoUrl: null }
  );
}

export async function PUT(req: Request) {
  const session = await resolveApiSession();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);

  try {
    const body = await req.json();
    const { primaryColor, footerText, logoUrl } = body;

    const settings = await db.documentSettings.upsert({
      where: { landlordId },
      create: {
        landlordId,
        primaryColor: primaryColor || "#5B00FF",
        footerText: footerText || null,
        logoUrl: logoUrl || null,
      },
      update: {
        primaryColor: primaryColor || "#5B00FF",
        footerText: footerText || null,
        logoUrl: logoUrl || null,
      },
    });

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
