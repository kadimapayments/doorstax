import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const search = params.get("search")?.trim() || "";
  const minBeds = params.get("minBeds");
  const maxBeds = params.get("maxBeds");
  const minBaths = params.get("minBaths");
  const maxBaths = params.get("maxBaths");
  const minRent = params.get("minRent");
  const maxRent = params.get("maxRent");
  const minSqft = params.get("minSqft");
  const maxSqft = params.get("maxSqft");

  const where: Prisma.UnitWhereInput = {
    listingEnabled: true,
    status: "AVAILABLE",
  };

  // Search by city, state, or zip on the related property
  if (search) {
    where.property = {
      OR: [
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
        { zip: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  // Bedroom filters
  if (minBeds) {
    where.bedrooms = { ...(where.bedrooms as object), gte: Number(minBeds) };
  }
  if (maxBeds) {
    where.bedrooms = { ...(where.bedrooms as object), lte: Number(maxBeds) };
  }

  // Bathroom filters
  if (minBaths) {
    where.bathrooms = { ...(where.bathrooms as object), gte: Number(minBaths) };
  }
  if (maxBaths) {
    where.bathrooms = { ...(where.bathrooms as object), lte: Number(maxBaths) };
  }

  // Rent filters
  if (minRent) {
    where.rentAmount = { ...(where.rentAmount as object), gte: new Prisma.Decimal(minRent) };
  }
  if (maxRent) {
    where.rentAmount = { ...(where.rentAmount as object), lte: new Prisma.Decimal(maxRent) };
  }

  // Square footage filters
  if (minSqft) {
    where.sqft = { ...(where.sqft as object), gte: Number(minSqft) };
  }
  if (maxSqft) {
    where.sqft = { ...(where.sqft as object), lte: Number(maxSqft) };
  }

  const listings = await db.unit.findMany({
    where,
    include: {
      property: {
        select: {
          name: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          photos: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(listings);
}
