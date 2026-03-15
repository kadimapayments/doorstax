import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PROPERTY_MIGRATION_PRESETS } from "@/lib/property-migration-presets";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    PROPERTY_MIGRATION_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      instructions: p.instructions,
      supportedFields: p.supportedFields,
    }))
  );
}
