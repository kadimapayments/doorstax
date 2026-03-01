import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("Test1234!", 12);

  // Create landlord
  const landlord = await prisma.user.upsert({
    where: { email: "landlord@doorstax.com" },
    update: {},
    create: {
      email: "landlord@doorstax.com",
      name: "Demo Landlord",
      role: "LANDLORD",
      passwordHash,
    },
  });

  console.log("Landlord created:", landlord.email);

  // Create a property with units
  const property = await prisma.property.upsert({
    where: { id: "seed-property-1" },
    update: {},
    create: {
      id: "seed-property-1",
      landlordId: landlord.id,
      name: "Sunset Apartments",
      address: "456 Palm Avenue",
      city: "Los Angeles",
      state: "CA",
      zip: "90028",
    },
  });

  const unit1 = await prisma.unit.upsert({
    where: { id: "seed-unit-1" },
    update: {},
    create: {
      id: "seed-unit-1",
      propertyId: property.id,
      unitNumber: "101",
      bedrooms: 2,
      bathrooms: 1,
      sqft: 850,
      rentAmount: 1800,
      status: "OCCUPIED",
    },
  });

  await prisma.unit.upsert({
    where: { id: "seed-unit-2" },
    update: {},
    create: {
      id: "seed-unit-2",
      propertyId: property.id,
      unitNumber: "102",
      bedrooms: 1,
      bathrooms: 1,
      sqft: 650,
      rentAmount: 1400,
      status: "AVAILABLE",
    },
  });

  // Create tenant
  const tenant = await prisma.user.upsert({
    where: { email: "tenant@doorstax.com" },
    update: {},
    create: {
      email: "tenant@doorstax.com",
      name: "Demo Tenant",
      role: "TENANT",
      passwordHash,
    },
  });

  await prisma.tenantProfile.upsert({
    where: { userId: tenant.id },
    update: {},
    create: {
      userId: tenant.id,
      unitId: unit1.id,
      leaseStart: new Date("2025-01-01"),
      leaseEnd: new Date("2026-12-31"),
    },
  });

  console.log("Tenant created:", tenant.email);
  console.log("\n--- Test Credentials ---");
  console.log("Landlord: landlord@doorstax.com / Test1234!");
  console.log("Tenant:   tenant@doorstax.com / Test1234!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
