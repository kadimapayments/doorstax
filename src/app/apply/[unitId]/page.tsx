import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";
import { Building2, BedDouble, Bath } from "lucide-react";
import { ApplyGate } from "@/components/apply/apply-gate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      unitNumber: true,
      property: { select: { name: true } },
    },
  });
  if (!unit) return { title: "Apply" };
  return {
    title: `Apply for ${unit.property.name} \u2014 Unit ${unit.unitNumber}`,
  };
}

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { unitId } = await params;
  const { token } = await searchParams;

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      unitNumber: true,
      rentAmount: true,
      bedrooms: true,
      bathrooms: true,
      status: true,
      listingEnabled: true,
      property: {
        select: {
          name: true,
          address: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  if (!unit || !unit.property) notFound();

  // If token provided, validate server-side
  let verifiedEmail: string | null = null;
  let tokenError: string | null = null;

  if (token) {
    const record = await db.applicationToken.findUnique({
      where: { token },
    });
    if (!record) {
      tokenError = "Invalid application link";
    } else if (record.unitId !== unitId) {
      tokenError = "Invalid application link";
    } else if (record.usedAt) {
      tokenError = "This link has already been used";
    } else if (record.expiresAt < new Date()) {
      tokenError = "This link has expired. Please request a new one.";
    } else {
      verifiedEmail = record.email;

      // Record the click (non-blocking)
      try {
        await db.applicationToken.update({
          where: { id: record.id },
          data: {
            clickedAt: record.clickedAt || new Date(),
            clickCount: { increment: 1 },
          },
        });

        // Notify PM on first click only
        if (!record.clickedAt) {
          const clickUnit = await db.unit.findUnique({
            where: { id: record.unitId },
            select: { unitNumber: true, property: { select: { landlordId: true, name: true } } },
          });
          const pmId = clickUnit?.property?.landlordId;
          if (pmId) {
            const { notify } = await import("@/lib/notifications");
            notify({
              userId: pmId,
              createdById: pmId,
              type: "APPLICATION_LINK_CLICKED",
              title: "Application Link Opened",
              message: `${record.email} opened the application link for ${clickUnit?.property?.name || "property"} Unit ${clickUnit?.unitNumber || ""}`,
              severity: "info",
              actionUrl: "/dashboard/applications",
            }).catch(console.error);
          }
        }
      } catch {
        // Non-blocking
      }
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo-dark.svg"
              alt="DoorStax"
              width={120}
              height={28}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.svg"
              alt="DoorStax"
              width={120}
              height={28}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-xl font-bold text-center">Rental Application</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Apply for a unit at {unit.property.name}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Property card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{unit.property.name}</h2>
              <p className="text-sm text-muted-foreground">
                {unit.property.address}, {unit.property.city},{" "}
                {unit.property.state} {unit.property.zip}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                {formatCurrency(Number(unit.rentAmount))}
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Unit {unit.unitNumber}
            </span>
            {unit.bedrooms !== null && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-4 w-4" />
                {unit.bedrooms} bed{unit.bedrooms !== 1 ? "s" : ""}
              </span>
            )}
            {unit.bathrooms !== null && (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {unit.bathrooms} bath{unit.bathrooms !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Gated application flow */}
        <ApplyGate
          unitId={unit.id}
          verifiedEmail={verifiedEmail}
          tokenError={tokenError}
          token={token || null}
          unitInfo={{
            unitNumber: unit.unitNumber,
            rent: Number(unit.rentAmount),
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
          }}
          propertyInfo={{
            name: unit.property.name,
            address: unit.property.address,
            city: unit.property.city,
            state: unit.property.state,
            zip: unit.property.zip,
          }}
        />
      </div>
    </main>
  );
}
