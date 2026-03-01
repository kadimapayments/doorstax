import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MapPin, Bed, Bath, Maximize } from "lucide-react";

export const metadata = {
  title: "Available Rentals | DoorStax",
  description: "Browse available rental units. Find your next home with DoorStax.",
};

export default async function ListingsPage() {
  const listings = await db.unit.findMany({
    where: { listingEnabled: true, status: "AVAILABLE" },
    include: {
      property: {
        select: { name: true, address: true, city: true, state: true, zip: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Image src="/logo-dark.svg" alt="DoorStax" width={130} height={30} className="dark:hidden" />
            <Image src="/logo-white.svg" alt="DoorStax" width={130} height={30} className="hidden dark:block" />
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Available Rentals</h1>
        <p className="mt-2 text-muted-foreground">
          Browse {listings.length} available unit{listings.length !== 1 ? "s" : ""}.
        </p>

        {listings.length === 0 ? (
          <div className="mt-12 text-center text-muted-foreground">
            <p>No listings available right now. Check back soon!</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((unit) => (
              <Link key={unit.id} href={`/listings/${unit.id}`}>
                <Card className="border-border transition-colors hover:border-border-hover overflow-hidden">
                  <div className="aspect-[16/10] bg-muted" />
                  <CardContent className="p-5">
                    <p className="text-2xl font-bold">
                      {formatCurrency(Number(unit.rentAmount))}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <h3 className="mt-1 font-semibold">
                      {unit.property.name} — Unit {unit.unitNumber}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {unit.property.city}, {unit.property.state}
                    </p>
                    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                      {unit.bedrooms !== null && (
                        <span className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5" /> {unit.bedrooms} bed
                        </span>
                      )}
                      {unit.bathrooms !== null && (
                        <span className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {unit.bathrooms} bath
                        </span>
                      )}
                      {unit.sqft !== null && (
                        <span className="flex items-center gap-1">
                          <Maximize className="h-3.5 w-3.5" /> {unit.sqft} sqft
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
