import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { generateInviteToken, hashToken } from "@/lib/invite-tokens";
import { getResend } from "@/lib/email";
import { tenantInviteHtml } from "@/lib/emails/tenant-invite";
import { z } from "zod";

interface Ctx {
  params: Promise<{ id: string }>;
}

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

/* ── PUT: approve or reject a roommate request (PM only) ── */

export async function PUT(req: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const data = actionSchema.parse(body);

    const request = await db.roommateRequest.findFirst({
      where: { id, landlordId: session.user.id },
      include: {
        tenantProfile: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request already processed" },
        { status: 409 }
      );
    }

    if (data.action === "approve") {
      // Update request status
      await db.roommateRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          processedAt: new Date(),
          processedById: session.user.id,
          note: data.note || null,
        },
      });

      // Create tenant invite for the roommate
      const rawToken = generateInviteToken();
      const tokenHash = await hashToken(rawToken);

      await db.tenantInvite.create({
        data: {
          landlordId: session.user.id,
          unitId: request.unitId,
          name: request.name,
          email: request.email,
          tokenHash,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });

      // Send invite email to the roommate
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const inviteUrl = `${baseUrl}/invite/${rawToken}`;

      try {
        await getResend().emails.send({
          from: "DoorStax <notifications@doorstax.com>",
          to: request.email,
          subject: `You're invited to join ${request.unit.property.name} on DoorStax`,
          html: tenantInviteHtml({
            propertyName: request.unit.property.name,
            unitName: request.unit.unitNumber,
            inviteUrl,
            landlordName: session.user.name || "Your Property Manager",
            tenantName: request.name,
          }),
        });
      } catch (emailErr) {
        console.error("[roommate-approve] Email send failed:", emailErr);
      }

      // Notify the tenant that their roommate was approved
      await notify({
        userId: request.tenantProfile.user.id,
        createdById: session.user.id,
        type: "ROOMMATE_APPROVED",
        title: "Roommate Request Approved",
        message: `Your roommate request for ${request.name} has been approved. An invitation has been sent to ${request.email}.`,
        severity: "info",
      });

      return NextResponse.json({ success: true, action: "approved" });
    }

    // Reject
    await db.roommateRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        processedById: session.user.id,
        note: data.note || null,
      },
    });

    // Notify the tenant that their roommate was rejected
    await notify({
      userId: request.tenantProfile.user.id,
      createdById: session.user.id,
      type: "ROOMMATE_REJECTED",
      title: "Roommate Request Declined",
      message: `Your roommate request for ${request.name} was declined.${data.note ? ` Note: ${data.note}` : ""}`,
      severity: "info",
    });

    return NextResponse.json({ success: true, action: "rejected" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("[roommate-request] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
