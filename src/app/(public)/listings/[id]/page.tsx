import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhotoCarousel } from "@/components/ui/photo-carousel";
import { formatCurrency } from "@/lib/utils";
import { MapPin, Bed, Bath, Maximize } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const unit = await db.unit.findUnique({
    where: { id },
    include: { property: { select: { name: true, city: true, state: true } } },
  });
  if (!unit) return { title: "Listing Not Found" };
  return {
    title: `${unit.property.name} Unit ${unit.unitNumber} — ${formatCurrency(Number(unit.rentAmount))}/mo`,
    description: `${unit.bedrooms || 0} bed, ${unit.bathrooms || 0} bath rental in ${unit.property.city}, ${unit.property.state}. Apply now on DoorStax.`,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const unit = await db.unit.findUnique({
    where: { id, listingEnabled: true },
    include: {
      property: {
        select: { name: true, address: true, city: true, state: true, zip: true, photos: true },
      },
    },
  });

  if (!unit) notFound();

  return (
    <main className="min-h-screen">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Image src="/logo-dark.svg" alt="DoorStax" width={130} height={30} className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={130} height={30} className="hidden dark:block" />
          </Link>
          <div className="flex gap-2">
            <Link href="/listings">
              <Button variant="ghost" size="sm">All Listings</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12">
        <PhotoCarousel
          photos={[
            ...(unit.photos || []),
            ...(unit.property.photos || []),
          ]}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">
                {unit.property.name} — Unit {unit.unitNumber}
              </h1>
              <p className="mt-2 flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {unit.property.address}, {unit.property.city},{" "}
                {unit.property.state} {unit.property.zip}
              </p>
            </div>

            <div className="flex gap-4">
              {unit.bedrooms !== null && (
                <div className="flex items-center gap-1.5">
                  <Bed className="h-4 w-4 text-muted-foreground" />
                  <span>{unit.bedrooms} Bedrooms</span>
                </div>
              )}
              {unit.bathrooms !== null && (
                <div className="flex items-center gap-1.5">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <span>{unit.bathrooms} Bathrooms</span>
                </div>
              )}
              {unit.sqft !== null && (
                <div className="flex items-center gap-1.5">
                  <Maximize className="h-4 w-4 text-muted-foreground" />
                  <span>{unit.sqft} sqft</span>
                </div>
              )}
            </div>

            {unit.description && (
              <p className="text-muted-foreground">{unit.description}</p>
            )}

            {unit.amenities.length > 0 && (
              <div>
                <h3 className="font-semibold">Amenities</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unit.amenities.map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Card className="sticky top-24 border-border">
              <CardContent className="p-6 space-y-4">
                <p className="text-3xl font-bold">
                  {formatCurrency(Number(unit.rentAmount))}
                  <span className="text-base font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Due on the {unit.dueDay}th of each month
                </p>
                {unit.applicationsEnabled ? (
                  <Link href={`/apply/${unit.id}`}>
                    <Button className="w-full" size="lg">Apply Now</Button>
                  </Link>
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    Applications Closed
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
