import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/invite-tokens";
import { z } from "zod";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = acceptSchema.parse(body);

    // Find all non-expired, non-accepted invites and check token
    const invites = await db.tenantInvite.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        unit: { select: { id: true, rentAmount: true, dueDay: true } },
      },
    });

    let matchedInvite = null;
    for (const invite of invites) {
      const isValid = await verifyToken(data.token, invite.tokenHash);
      if (isValid) {
        matchedInvite = invite;
        break;
      }
    }

    if (!matchedInvite) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findFirst({
      where: { email: { equals: matchedInvite.email, mode: "insensitive" } },
      include: {
        tenantProfile: {
          select: { id: true, unitId: true, kadimaCustomerId: true },
        },
      },
    });

    if (existingUser) {
      // Pre-created tenant from "Add Tenant" flow — update password & complete setup
      if (existingUser.role === "TENANT") {
        const passwordHash = await hash(data.password, 12);
        await db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { passwordHash, name: data.name, phone: data.phone },
          });
          await tx.tenantInvite.update({
            where: { id: matchedInvite.id },
            data: { acceptedAt: new Date() },
          });
          // Ensure profile has unitId + is active (fixes re-invited / previously deleted tenants)
          if (existingUser.tenantProfile) {
            await tx.tenantProfile.update({
              where: { id: existingUser.tenantProfile.id },
              data: {
                unitId: matchedInvite.unitId,
                status: "ACTIVE",
                deletedAt: null,
                deletionReason: null,
                deletionNotes: null,
                onboardingComplete: false,
                onboardingStep: "PERSONAL_DETAILS",
              },
            });
          }
        });

        // Provision vault customer if not already done (awaited for Vercel serverless)
        const profile = existingUser.tenantProfile;
        if (profile && !profile.kadimaCustomerId) {
          const nameParts = data.name.split(" ");
          try {
            await provisionVaultCustomer({
              tenantProfileId: profile.id,
              firstName: nameParts[0] || "Tenant",
              lastName: nameParts.slice(1).join(" ") || "",
              email: matchedInvite.email,
              phone: data.phone,
            });
          } catch (err) {
            console.error("[invite-accept] Vault provisioning failed:", err);
          }
        }

        return NextResponse.json({ success: true, email: matchedInvite.email });
      }

      // Non-tenant user with same email — reject
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(data.password, 12);

    // Create user + tenant profile + mark invite accepted + update unit status
    const txResult = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: matchedInvite.email.toLowerCase().trim(),
          name: data.name,
          passwordHash,
          role: "TENANT",
          phone: data.phone,
        },
      });

      const tenantProfile = await tx.tenantProfile.create({
        data: {
          userId: user.id,
          unitId: matchedInvite.unitId,
        },
      });

      await tx.tenantInvite.update({
        where: { id: matchedInvite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.unit.update({
        where: { id: matchedInvite.unitId },
        data: { status: "OCCUPIED" },
      });

      // Create initial charge payments from stored line items
      const charges = matchedInvite.initialCharges as
        | { description: string; amount: number; type: string }[]
        | null;
      if (charges && Array.isArray(charges) && charges.length > 0) {
        for (const item of charges) {
          await tx.payment.create({
            data: {
              tenantId: tenantProfile.id,
              unitId: matchedInvite.unitId,
              landlordId: matchedInvite.landlordId,
              amount: item.amount,
              type: item.type as "RENT" | "DEPOSIT" | "FEE" | "APPLICATION",
              status: "PENDING",
              dueDate: new Date(),
              description: item.description,
            },
          });
        }
      }

      return { user, tenantProfile };
    });

    // Provision Kadima vault customer (awaited for Vercel serverless)
    const inviteNameParts = data.name.split(" ");
    try {
      await provisionVaultCustomer({
        tenantProfileId: txResult.tenantProfile.id,
        firstName: inviteNameParts[0] || "Tenant",
        lastName: inviteNameParts.slice(1).join(" ") || "",
        email: matchedInvite.email,
        phone: data.phone,
      });
    } catch (err) {
      console.error("[invite-accept] Vault provisioning failed:", err);
    }

    return NextResponse.json({ success: true, email: matchedInvite.email });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
