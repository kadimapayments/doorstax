import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOnboardingProgress } from "@/lib/onboarding";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const progress = await getOnboardingProgress(session.user.id);
  return NextResponse.json(progress);
}
