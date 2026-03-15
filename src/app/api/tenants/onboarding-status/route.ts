import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const landlordId = await getEffectiveLandlordId(session.user.id);
  const now = new Date();

  // Fetch all invites for this landlord
  const invites = await db.tenantInvite.findMany({
    where: { landlordId },
    include: {
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all tenant profiles (to get onboarding step info)
  const profiles = await db.tenantProfile.findMany({
    where: {
      unit: { property: { landlordId } },
      deletedAt: null,
    },
    include: {
      user: { select: { email: true, name: true } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  // Build a profile lookup by email
  const profileByEmail = new Map<
    string,
    (typeof profiles)[0]
  >();
  for (const p of profiles) {
    profileByEmail.set(p.user.email.toLowerCase(), p);
  }

  // Build tenant status rows
  const rows: {
    id: string;
    inviteId: string | null;
    name: string;
    email: string;
    property: string;
    unit: string;
    status: "PENDING" | "EXPIRED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED";
    onboardingStep: string;
    invitedAt: string;
    acceptedAt: string | null;
  }[] = [];

  const seen = new Set<string>();

  for (const invite of invites) {
    const email = invite.email.toLowerCase();
    if (seen.has(email)) continue; // latest invite only
    seen.add(email);

    const profile = profileByEmail.get(email);
    const isExpired = !invite.acceptedAt && invite.expiresAt < now;
    const isAccepted = !!invite.acceptedAt;

    let status: typeof rows[0]["status"];
    let onboardingStep = "—";

    if (profile) {
      if (profile.onboardingComplete) {
        status = "COMPLETED";
        onboardingStep = "COMPLETE";
      } else {
        status = "IN_PROGRESS";
        onboardingStep = profile.onboardingStep || "PERSONAL_DETAILS";
      }
    } else if (isAccepted) {
      status = "ACCEPTED";
    } else if (isExpired) {
      status = "EXPIRED";
    } else {
      status = "PENDING";
    }

    rows.push({
      id: profile?.id || invite.id,
      inviteId: invite.id,
      name: profile?.user.name || invite.name || email,
      email,
      property: invite.unit?.property?.name || profile?.unit?.property?.name || "—",
      unit: invite.unit?.unitNumber || profile?.unit?.unitNumber || "—",
      status,
      onboardingStep,
      invitedAt: invite.createdAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() || null,
    });
  }

  // Compute metrics
  const metrics = {
    totalInvited: rows.length,
    pending: rows.filter((r) => r.status === "PENDING").length,
    expired: rows.filter((r) => r.status === "EXPIRED").length,
    inProgress: rows.filter((r) => r.status === "ACCEPTED" || r.status === "IN_PROGRESS").length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
  };

  return NextResponse.json({ metrics, rows });
}
