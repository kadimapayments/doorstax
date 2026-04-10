import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const application = await db.application.findFirst({
    where: {
      id,
      unit: { property: { landlordId: session.user.id } },
    },
    include: {
      unit: {
        select: {
          unitNumber: true,
          rentAmount: true,
          property: { select: { name: true, address: true } },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PM") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const application = await db.application.findFirst({
    where: {
      id,
      unit: { property: { landlordId: session.user.id } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = updateStatusSchema.parse(body);

    const updated = await db.application.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
      },
    });

    // When approved, copy application documents to the tenant's profile
    if (data.status === "APPROVED") {
      try {
        // Find existing tenant profile for this unit + email
        const tenantProfile = await db.tenantProfile.findFirst({
          where: {
            unit: { id: application.unitId },
            user: { email: { equals: application.email, mode: "insensitive" } },
          },
          select: { id: true },
        });

        if (tenantProfile) {
          const docsToCreate: {
            tenantProfileId: string;
            landlordId: string;
            name: string;
            type: string;
            url: string;
            fileName: string | null;
            source: string;
            applicationId: string;
          }[] = [];

          // Fetch full application with PDF URL
          const fullApp = await db.application.findUnique({
            where: { id },
            select: {
              applicationPdfUrl: true,
              name: true,
              signedAt: true,
            },
          });

          // Copy signed application PDF
          if (fullApp?.applicationPdfUrl) {
            docsToCreate.push({
              tenantProfileId: tenantProfile.id,
              landlordId: session.user.id,
              name: `Signed Application \u2014 ${fullApp.name || application.name}`,
              type: "APPLICATION",
              url: fullApp.applicationPdfUrl,
              fileName: "Application.pdf",
              source: "APPLICATION",
              applicationId: id,
            });
          }

          if (docsToCreate.length > 0) {
            await db.tenantDocument.createMany({ data: docsToCreate });
            console.log(`[application] Copied ${docsToCreate.length} docs to tenant ${tenantProfile.id}`);
          }
        }
      } catch (docErr) {
        console.error("[application] Failed to copy docs to tenant:", docErr);
      }
    }

    return NextResponse.json(updated);
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
