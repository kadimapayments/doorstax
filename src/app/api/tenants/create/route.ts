import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { z } from "zod";
import { emit } from "@/lib/events/emitter";
import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";
import { getResend } from "@/lib/email";
import { tenantInviteHtml } from "@/lib/emails/tenant-invite";
import { completeOnboardingMilestone } from "@/lib/onboarding";

const lineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  type: z.enum(["RENT", "DEPOSIT", "FEE", "APPLICATION"]),
});

const createTenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  unitId: z.string().min(1, "Unit is required"),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  splitPercent: z.coerce.number().min(1).max(100).default(100),
  isPrimary: z.boolean().default(true),
  lineItems: z.array(lineItemSchema).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createTenantSchema.parse(body);

    // Verify landlord owns the unit
    const unit = await db.unit.findFirst({
      where: {
        id: data.unitId,
        property: { landlordId: session.user.id },
      },
      include: { property: { select: { name: true } } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Check if email already has an account
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists. Use 'Invite Tenant' instead." },
        { status: 409 }
      );
    }

    // Generate invite token for password setup
    const rawToken = generateInviteToken();
    const tokenHash = await hashToken(rawToken);

    // Create user (no password) + tenant profile + invite for password setup
    const result = await db.$transaction(async (tx) => {
      // Create user with a random placeholder password (tenant will set real one via invite link)
      const placeholderHash = await hashToken(generateInviteToken());
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: placeholderHash,
          role: "TENANT",
          phone: data.phone,
        },
      });

      const tenantProfile = await tx.tenantProfile.create({
        data: {
          userId: user.id,
          unitId: data.unitId,
          leaseStart: data.leaseStart ? new Date(data.leaseStart) : undefined,
          leaseEnd: data.leaseEnd ? new Date(data.leaseEnd) : undefined,
          splitPercent: data.splitPercent,
          isPrimary: data.isPrimary,
        },
      });

      // Create invite so tenant can set their password
      const invite = await tx.tenantInvite.create({
        data: {
          landlordId: session.user.id,
          unitId: data.unitId,
          email: data.email,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Update unit status
      await tx.unit.update({
        where: { id: data.unitId },
        data: { status: "OCCUPIED" },
      });

      // Auto-redistribute splits evenly among all tenants in the unit
      const allProfiles = await tx.tenantProfile.findMany({
        where: { unitId: data.unitId },
      });

      const count = allProfiles.length;
      const evenSplit = Math.floor(100 / count);
      const remainder = 100 - evenSplit * count;

      // Update each tenant's splitPercent (primary gets the remainder)
      for (const profile of allProfiles) {
        const pct = profile.isPrimary ? evenSplit + remainder : evenSplit;
        await tx.tenantProfile.update({
          where: { id: profile.id },
          data: { splitPercent: pct },
        });
      }

      // Upsert RentSplit + RentSplitItems for the unit
      const existingSplit = await tx.rentSplit.findUnique({
        where: { unitId: data.unitId },
      });

      if (existingSplit) {
        await tx.rentSplitItem.deleteMany({
          where: { rentSplitId: existingSplit.id },
        });
        await tx.rentSplit.delete({ where: { id: existingSplit.id } });
      }

      const totalRent = Number(unit.rentAmount);
      await tx.rentSplit.create({
        data: {
          unitId: data.unitId,
          totalRent: unit.rentAmount,
          splits: {
            create: allProfiles.map((profile) => {
              const pct = profile.isPrimary ? evenSplit + remainder : evenSplit;
              return {
                tenantId: profile.id,
                percent: pct,
                amount: (totalRent * pct) / 100,
              };
            }),
          },
        },
      });

      // Create initial charge payments (line items) if provided
      if (data.lineItems && data.lineItems.length > 0) {
        for (const item of data.lineItems) {
          await tx.payment.create({
            data: {
              tenantId: tenantProfile.id,
              unitId: data.unitId,
              landlordId: session.user.id,
              amount: item.amount,
              type: item.type,
              status: "PENDING",
              dueDate: data.leaseStart ? new Date(data.leaseStart) : new Date(),
              description: item.description,
            },
          });
        }
      }

      return { user, tenantProfile, invite };
    });

    // Emit tenant.created event (awaited so it completes before Vercel kills the function)
    try {
      await emit({
        eventType: "tenant.created",
        aggregateType: "TenantProfile",
        aggregateId: result.tenantProfile.id,
        payload: { userId: result.user.id, tenantProfileId: result.tenantProfile.id },
        emittedBy: session.user.id,
      });
    } catch (err) {
      console.error("[create-tenant] Event emit failed:", err);
    }

    // Guided Launch Mode: mark tenant + invite milestones (this route creates both)
    completeOnboardingMilestone(session.user.id, "tenantAdded").catch(console.error);
    completeOnboardingMilestone(session.user.id, "inviteSent").catch(console.error);

    // Provision Kadima vault customer (awaited so it completes before Vercel kills the function)
    const nameParts = data.name.split(" ");
    try {
      await provisionVaultCustomer({
        tenantProfileId: result.tenantProfile.id,
        firstName: nameParts[0] || "Tenant",
        lastName: nameParts.slice(1).join(" ") || "",
        email: data.email,
        phone: data.phone,
      });
    } catch (err) {
      console.error("[create-tenant] Vault provisioning failed:", err);
    }

    // Build invite URL for password setup
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${rawToken}`;

    // Send invitation email so tenant can set their password
    try {
      await getResend().emails.send({
        from: "DoorStax <notifications@doorstax.com>",
        to: data.email,
        subject: `You're invited to join ${unit.property.name} on DoorStax`,
        html: tenantInviteHtml({
          propertyName: unit.property.name,
          unitName: unit.unitNumber,
          inviteUrl,
          landlordName: session.user.name || "Your Property Manager",
          tenantName: data.name,
        }),
      });
    } catch (emailErr) {
      console.error("[create-tenant] Invite email send failed:", emailErr);
    }

    return NextResponse.json(
      {
        success: true,
        tenantId: result.tenantProfile.id,
        ...(process.env.NODE_ENV === "development" && { inviteUrl }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Create tenant error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
