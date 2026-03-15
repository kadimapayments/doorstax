import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Test1234!", 12);

  // 1. Create tenant@doorstax.com
  const tenantUser = await db.user.upsert({
    where: { email: "tenant@doorstax.com" },
    update: {},
    create: {
      email: "tenant@doorstax.com",
      name: "Test Tenant",
      role: "TENANT",
      passwordHash,
    },
  });
  console.log("Tenant user:", tenantUser.id);

  // Find any PM user and their first unit
  const pm = await db.user.findFirst({ where: { role: "PM" } });
  if (pm) {
    const unit = await db.unit.findFirst({
      where: { property: { landlordId: pm.id } },
    });
    if (unit) {
      // Check if tenant profile already exists
      const existing = await db.tenantProfile.findUnique({ where: { userId: tenantUser.id } });
      if (!existing) {
        await db.tenantProfile.create({
          data: {
            userId: tenantUser.id,
            unitId: unit.id,
            leaseStart: new Date(),
            leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            splitPercent: 100,
            isPrimary: true,
          },
        });
        console.log("Tenant profile created for unit:", unit.id);
      }
    }
  }

  // 2. Create owner@doorstax.com
  const ownerUser = await db.user.upsert({
    where: { email: "owner@doorstax.com" },
    update: {},
    create: {
      email: "owner@doorstax.com",
      name: "Test Owner",
      role: "OWNER",
      passwordHash,
    },
  });
  console.log("Owner user:", ownerUser.id);

  // Find first Owner record and link it
  const owner = await db.owner.findFirst({ where: { userId: null } });
  if (owner) {
    await db.owner.update({
      where: { id: owner.id },
      data: { userId: ownerUser.id },
    });
    console.log("Linked owner record:", owner.id, "to user:", ownerUser.id);
  } else {
    console.log("No unlinked owner record found to link");
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
