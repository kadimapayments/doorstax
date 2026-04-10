import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const body = await req.json();
    const { answers, applicantName, applicantEmail, applicantPhone, token } = body;

    if (!applicantName || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "applicantName and answers[] are required" },
        { status: 400 }
      );
    }

    // Resolve unit → property → PM
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        unitNumber: true,
        property: {
          select: { name: true, landlordId: true },
        },
      },
    });

    if (!unit || !unit.property) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const pmId = unit.property.landlordId;

    // Validate required fields
    const requiredFields = await db.applicationField.findMany({
      where: { pmId, enabled: true, required: true },
      select: { id: true, label: true },
    });
    const answeredIds = new Set(
      answers.map((a: { fieldId: string }) => a.fieldId)
    );
    const missing = requiredFields.filter(
      (f) =>
        !answeredIds.has(f.id) ||
        !answers.find(
          (a: { fieldId: string; value: string }) =>
            a.fieldId === f.id && a.value?.trim()
        )
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          missingFields: missing.map((f) => f.label),
        },
        { status: 400 }
      );
    }

    // Find income from answers (for Application.income field)
    const incomeField = await db.applicationField.findFirst({
      where: { pmId, label: { contains: "Income", mode: "insensitive" }, enabled: true },
      select: { id: true },
    });
    const incomeAnswer = incomeField
      ? answers.find((a: { fieldId: string; value: string }) => a.fieldId === incomeField.id)
      : null;
    const income = incomeAnswer ? Number(incomeAnswer.value) || 0 : 0;

    // Find employer from answers
    const employerField = await db.applicationField.findFirst({
      where: { pmId, label: { contains: "Employer", mode: "insensitive" }, enabled: true },
      select: { id: true },
    });
    const employerAnswer = employerField
      ? answers.find((a: { fieldId: string; value: string }) => a.fieldId === employerField.id)
      : null;

    // Create Application + answers in a transaction
    const application = await db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          unitId,
          name: applicantName,
          email: applicantEmail || "",
          phone: applicantPhone || "",
          employment: employerAnswer?.value || "Not provided",
          employer: employerAnswer?.value || null,
          income,
          customData: { source: "WEBSITE" },
          status: "PENDING",
        },
      });

      // Create field answers
      const validAnswers = answers.filter(
        (a: { fieldId: string; value: string }) =>
          a.fieldId && a.value !== undefined && a.value !== null
      );
      if (validAnswers.length > 0) {
        await tx.applicationFieldAnswer.createMany({
          data: validAnswers.map(
            (a: { fieldId: string; value: string }) => ({
              applicationId: app.id,
              fieldId: a.fieldId,
              value: String(a.value),
            })
          ),
        });
      }

      return app;
    });

    // Mark token as used
    if (token) {
      try {
        await db.applicationToken.updateMany({
          where: { token, usedAt: null },
          data: { usedAt: new Date() },
        });
      } catch { /* non-blocking */ }
    }

    // Notify PM (non-blocking)
    try {
      const pmUser = await db.user.findUnique({
        where: { id: pmId },
        select: { id: true, email: true, name: true },
      });

      if (pmUser) {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: pmUser.id,
          createdById: pmUser.id,
          type: "NEW_APPLICATION",
          title: "New Application Received",
          message: `${applicantName} applied for ${unit.property.name} \u2014 Unit ${unit.unitNumber}`,
          severity: "info",
          actionUrl: "/dashboard/applications",
        }).catch(console.error);

        if (pmUser.email) {
          const { getResend } = await import("@/lib/email");
          const { newApplicationEmail } = await import("@/lib/emails/new-application");
          const resend = getResend();
          await resend.emails
            .send({
              from: "DoorStax <noreply@doorstax.com>",
              to: pmUser.email,
              subject: `New Application: ${applicantName} \u2014 ${unit.property.name} Unit ${unit.unitNumber}`,
              html: newApplicationEmail({
                pmName: pmUser.name || "Property Manager",
                applicantName,
                applicantEmail: applicantEmail || undefined,
                applicantPhone: applicantPhone || undefined,
                propertyName: unit.property.name,
                unitName: `Unit ${unit.unitNumber}`,
                submittedAt: new Date().toLocaleString(),
              }),
            })
            .catch(console.error);
        }
      }
    } catch (err) {
      console.error("[apply] Failed to notify PM:", err);
    }

    return NextResponse.json({
      applicationId: application.id,
      status: "submitted",
    });
  } catch (err) {
    console.error("[apply/:unitId/submit] error:", err);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
