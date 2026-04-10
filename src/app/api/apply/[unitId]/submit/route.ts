import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const body = await req.json();
    const {
      answers,
      applicantName,
      applicantEmail,
      applicantPhone,
      token,
      signatureImage,
      signatureTypedName,
    } = body;

    if (!applicantName || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "applicantName and answers[] are required" },
        { status: 400 }
      );
    }

    if (!signatureImage) {
      return NextResponse.json(
        { error: "Signature is required" },
        { status: 400 }
      );
    }
    if (!signatureTypedName || String(signatureTypedName).trim().length < 2) {
      return NextResponse.json(
        { error: "Please type your full legal name" },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const signedAt = new Date();

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
          signatureImage: signatureImage || null,
          signatureTypedName: signatureTypedName || null,
          signedAt,
          signedIpAddress: ip,
          signedUserAgent: userAgent,
        },
      });

      // Create field answers — only for real ApplicationField IDs (not template-generated)
      const allAnswers = answers.filter(
        (a: { fieldId: string; value: string }) =>
          a.fieldId && a.value !== undefined && a.value !== null
      );

      // Separate real DB field IDs from template-generated IDs (tpl-*)
      const realFieldAnswers = allAnswers.filter(
        (a: { fieldId: string }) => !a.fieldId.startsWith("tpl-")
      );
      const templateFieldAnswers = allAnswers.filter(
        (a: { fieldId: string }) => a.fieldId.startsWith("tpl-")
      );

      if (realFieldAnswers.length > 0) {
        // Validate real field IDs exist before inserting
        const submittedIds = realFieldAnswers.map((a: { fieldId: string }) => a.fieldId);
        const validFields = await tx.applicationField.findMany({
          where: { id: { in: submittedIds } },
          select: { id: true },
        });
        const validIds = new Set(validFields.map((f) => f.id));

        const verified = realFieldAnswers.filter(
          (a: { fieldId: string }) => validIds.has(a.fieldId)
        );
        if (verified.length > 0) {
          await tx.applicationFieldAnswer.createMany({
            data: verified.map(
              (a: { fieldId: string; value: string }) => ({
                applicationId: app.id,
                fieldId: a.fieldId,
                value: String(a.value),
              })
            ),
          });
        }
      }

      // Store template answers as JSON in customData (these have tpl-* IDs)
      if (templateFieldAnswers.length > 0) {
        await tx.application.update({
          where: { id: app.id },
          data: {
            customData: {
              source: "WEBSITE",
              templateAnswers: templateFieldAnswers.map(
                (a: { fieldId: string; value: string }) => ({
                  fieldId: a.fieldId,
                  value: String(a.value),
                })
              ),
            },
          },
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

    // Generate PDF + notify PM (non-blocking)
    try {
      const pmUser = await db.user.findUnique({
        where: { id: pmId },
        select: { id: true, email: true, name: true },
      });

      // Generate application PDF
      let pdfBuffer: Buffer | null = null;
      try {
        const { generateApplicationPdf } = await import(
          "@/lib/application-pdf-generator"
        );

        // Build sections from answers
        const allFieldAnswers = [
          ...answers.map((a: { fieldId: string; value: string }) => ({
            fieldId: a.fieldId,
            value: a.value,
          })),
        ];
        const sectionLabels: Record<string, string> = {
          PERSONAL: "Personal Information",
          EMPLOYMENT: "Employment",
          RENTAL_HISTORY: "Rental History",
          REFERENCES: "References",
          CUSTOM: "Additional Information",
        };
        const sections = Object.entries(sectionLabels).map(
          ([, title]) => ({
            title,
            fields: allFieldAnswers
              .filter((a) => a.value)
              .slice(0, 5)
              .map((a) => ({
                label: a.fieldId.replace(/^tpl-\d+-/, "").replace(/_/g, " "),
                value: String(a.value),
                type: "TEXT",
              })),
          })
        );

        // Try to get real field data from DB
        try {
          const dbAnswers = await db.applicationFieldAnswer.findMany({
            where: { applicationId: application.id },
            include: {
              field: {
                select: {
                  label: true,
                  type: true,
                  section: true,
                  sortOrder: true,
                },
              },
            },
            orderBy: { field: { sortOrder: "asc" } },
          });
          if (dbAnswers.length > 0) {
            const sectionMap = new Map<
              string,
              { label: string; value: string; type: string }[]
            >();
            for (const a of dbAnswers) {
              const sec = a.field?.section || "CUSTOM";
              if (!sectionMap.has(sec)) sectionMap.set(sec, []);
              sectionMap.get(sec)!.push({
                label: a.field?.label || "Field",
                value: a.value,
                type: a.field?.type || "TEXT",
              });
            }
            sections.length = 0;
            for (const [sec, title] of Object.entries(sectionLabels)) {
              if (sectionMap.has(sec)) {
                sections.push({ title, fields: sectionMap.get(sec)! });
              }
            }
          }
        } catch {
          /* use fallback sections */
        }

        pdfBuffer = await generateApplicationPdf({
          applicantName:
            applicantName || signatureTypedName || "Applicant",
          applicantEmail: applicantEmail || "",
          applicantPhone: applicantPhone || undefined,
          propertyName: unit.property?.name || "Property",
          unitName: `Unit ${unit.unitNumber}`,
          propertyAddress: undefined,
          sections: sections.filter((s) => s.fields.length > 0),
          signatureImage: signatureImage || "",
          signatureTypedName: signatureTypedName || "",
          signedAt,
          ipAddress: ip,
          userAgent,
          submittedAt: new Date(),
          applicationId: application.id,
        });
      } catch (pdfErr) {
        console.error("[apply] PDF generation failed:", pdfErr);
      }

      // In-app notification
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

        // Email with PDF attachment
        if (pmUser.email) {
          const { getResend } = await import("@/lib/email");
          const { newApplicationEmail } = await import(
            "@/lib/emails/new-application"
          );
          const resend = getResend();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const emailPayload: any = {
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
          };

          if (pdfBuffer) {
            emailPayload.attachments = [
              {
                filename: `Application_${(applicantName || "Applicant").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
                content: pdfBuffer,
              },
            ];
          }

          await resend.emails.send(emailPayload).catch(console.error);
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
