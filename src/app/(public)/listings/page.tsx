import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ListingsSearch } from "@/components/listings/listings-search";

export const metadata = {
  title: "Available Rentals | DoorStax",
  description: "Browse available rental units. Find your next home with DoorStax.",
};

export default async function ListingsPage() {
  const rawListings = await db.unit.findMany({
    where: { listingEnabled: true, status: "AVAILABLE" },
    include: {
      property: {
        select: { name: true, address: true, city: true, state: true, zip: true, photos: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Decimal fields for client component
  const listings = rawListings.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    sqft: u.sqft,
    rentAmount: Number(u.rentAmount),
    photos: u.photos,
    property: u.property,
  }));

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

        <ListingsSearch initialListings={listings} />
      </div>
    </main>
  );
}
