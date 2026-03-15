import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { hash } from "bcryptjs";

const db = new PrismaClient();

const now = new Date();

function periodStart(monthsBack: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return d;
}
function periodEnd(monthsBack: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function main() {
  // ──────────────────────────────────────────────
  // Find all PM users
  // ──────────────────────────────────────────────
  const pms = await db.user.findMany({ where: { role: "PM" } });
  if (pms.length === 0) {
    console.log("No PM users found — run the main seed first.");
    return;
  }

  console.log(`Found ${pms.length} PM(s): ${pms.map((p) => p.email).join(", ")}`);

  // ══════════════════════════════════════════════════════
  // C1: CREATE SAMPLE VENDORS FOR EACH PM
  // ══════════════════════════════════════════════════════
  console.log("\n── C1: Creating Sample Vendors ──");

  const vendorTemplates = [
    { name: "Reliable Plumbing Co.", category: "PLUMBING", company: "Reliable Plumbing Co.", email: "service@reliableplumbing.com", phone: "(555) 101-2001", taxId: "12-3456789", taxIdType: "EIN", w9Status: "VERIFIED" },
    { name: "Bright Spark Electric", category: "ELECTRICAL", company: "Bright Spark Electric LLC", email: "info@brightspark.com", phone: "(555) 201-3002", taxId: "98-7654321", taxIdType: "EIN", w9Status: "RECEIVED" },
    { name: "CoolBreeze HVAC", category: "HVAC", company: "CoolBreeze Heating & Cooling", email: "dispatch@coolbreezehvac.com", phone: "(555) 301-4003", taxId: "45-6789012", taxIdType: "EIN", w9Status: "VERIFIED" },
    { name: "Green Thumb Landscaping", category: "LANDSCAPING", company: "Green Thumb Landscaping Inc.", email: "quotes@greenthumb.com", phone: "(555) 401-5004", w9Status: "REQUESTED" },
    { name: "Premium Cleaning Services", category: "CLEANING", company: "Premium Cleaning Services", email: "book@premiumclean.com", phone: "(555) 501-6005", w9Status: "NOT_REQUESTED" },
    { name: "AllPro Maintenance", category: "GENERAL", company: "AllPro Property Maintenance", email: "work@allpromaint.com", phone: "(555) 601-7006", taxId: "67-8901234", taxIdType: "EIN", w9Status: "VERIFIED" },
    { name: "SafeGuard Pest Control", category: "PEST_CONTROL", company: "SafeGuard Pest Control", email: "schedule@safeguardpest.com", phone: "(555) 701-8007", w9Status: "REQUESTED" },
    { name: "RoofRight Solutions", category: "ROOFING", company: "RoofRight Solutions", email: "estimates@roofright.com", phone: "(555) 801-9008", taxId: "23-4567890", taxIdType: "EIN", w9Status: "RECEIVED" },
  ];

  for (const pm of pms) {
    // Check if vendors already exist for this PM
    const existingVendors = await db.vendor.count({ where: { landlordId: pm.id } });
    if (existingVendors >= 5) {
      console.log(`  ${pm.email}: Already has ${existingVendors} vendors, skipping.`);
      continue;
    }

    const created = await db.vendor.createMany({
      data: vendorTemplates.map((v) => ({
        landlordId: pm.id,
        name: v.name,
        category: v.category,
        company: v.company || null,
        email: v.email || null,
        phone: v.phone || null,
        taxId: v.taxId || null,
        taxIdType: v.taxIdType || null,
        w9Status: v.w9Status || "NOT_REQUESTED",
        isActive: true,
        rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10, // 3.5-5.0
      })),
      skipDuplicates: true,
    });
    console.log(`  ${pm.email}: Created ${created.count} vendors`);
  }

  // ══════════════════════════════════════════════════════
  // C2: CREATE SUBAGENT INVITE FOR agent@doorstax.com
  // ══════════════════════════════════════════════════════
  console.log("\n── C2: Creating Subagent Invite ──");

  // Use the first PM as the parent
  const parentPm = pms[0];

  // Check if invite already exists
  const existingInvite = await db.agentInvite.findFirst({
    where: { email: "agent@doorstax.com", parentPmId: parentPm.id },
  });

  if (existingInvite) {
    console.log(`  Invite already exists for agent@doorstax.com (parent: ${parentPm.email})`);
  } else {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await db.agentInvite.create({
      data: {
        parentPmId: parentPm.id,
        email: "agent@doorstax.com",
        tokenHash,
        perUnitCost: 2.5,
        commissionRate: 0.05, // 5%
        residualSplit: 0.1, // 10%
        cardRateOverride: 0.0325,
        achRateOverride: 3.0,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://app.doorstax.com";
    console.log(`  Created agent invite for agent@doorstax.com`);
    console.log(`  Parent PM: ${parentPm.email}`);
    console.log(`  Per-unit cost: $2.50, Commission: 5%, Residual split: 10%`);
    console.log(`  Invite URL: ${baseUrl}/register?invite=${token}`);
    console.log(`  Expires: ${expiresAt.toLocaleDateString()}`);
    console.log(`  Invite ID: ${invite.id}`);
  }

  // Create the actual agent User account so agent@doorstax.com can log in
  const existingAgentUser = await db.user.findUnique({
    where: { email: "agent@doorstax.com" },
  });

  if (existingAgentUser) {
    console.log(`  Agent user already exists: agent@doorstax.com`);
  } else {
    const passwordHash = await hash("Test1234!", 12);
    const agentUser = await db.user.create({
      data: {
        email: "agent@doorstax.com",
        name: "Agent Demo",
        role: "PM",
        passwordHash,
        companyName: "Agent Properties LLC",
        managerStatus: "ACTIVE",
        tosAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });

    // Create the AgentRelationship linking agent to parent PM
    await db.agentRelationship.create({
      data: {
        parentPmId: parentPm.id,
        agentUserId: agentUser.id,
        perUnitCost: 2.5,
        commissionRate: 0.05,
        residualSplit: 0.1,
        cardRateOverride: 0.0325,
        achRateOverride: 3.0,
        isActive: true,
      },
    });

    // Mark the invite as accepted
    const agentInvite = await db.agentInvite.findFirst({
      where: { email: "agent@doorstax.com", parentPmId: parentPm.id },
    });
    if (agentInvite) {
      await db.agentInvite.update({
        where: { id: agentInvite.id },
        data: { acceptedAt: new Date() },
      });
    }

    console.log(`  Created agent user: agent@doorstax.com (password: Test1234!)`);
    console.log(`  Linked to parent PM: ${parentPm.email}`);
  }

  // ══════════════════════════════════════════════════════
  // C3: GENERATE TAX CENTER DATA (OWNER PAYOUTS + EXPENSES)
  // ══════════════════════════════════════════════════════
  console.log("\n── C3: Generating Tax Center Data ──");

  for (const pm of pms) {
    // Get owners for this PM
    const owners = await db.owner.findMany({
      where: { landlordId: pm.id },
      include: {
        properties: {
          include: {
            units: true,
          },
        },
      },
    });

    if (owners.length === 0) {
      console.log(`  ${pm.email}: No owners found, skipping.`);
      continue;
    }

    // Check if payouts already exist for current year
    const existingPayouts = await db.ownerPayout.count({
      where: {
        landlordId: pm.id,
        periodStart: { gte: new Date(now.getFullYear(), 0, 1) },
      },
    });

    if (existingPayouts >= 3) {
      console.log(`  ${pm.email}: Already has ${existingPayouts} payouts this year, skipping.`);
      continue;
    }

    console.log(`  ${pm.email}: Creating payouts for ${owners.length} owner(s)...`);

    // Create monthly payouts for past months of this year
    const currentMonth = now.getMonth(); // 0-based
    const monthsToGenerate = Math.max(currentMonth, 1); // At least 1 month

    for (const owner of owners) {
      const totalUnits = owner.properties.reduce((sum, p) => sum + p.units.length, 0);
      const baseRent = totalUnits * (1200 + Math.floor(Math.random() * 800)); // $1200-$2000 per unit

      for (let m = 0; m < monthsToGenerate; m++) {
        const grossRent = baseRent + Math.floor(Math.random() * 200) - 100;
        const processingFees = Math.round(grossRent * 0.03 * 100) / 100;
        const managementFee = Math.round(grossRent * 0.08 * 100) / 100;
        const expenses = Math.round((100 + Math.random() * 400) * 100) / 100;
        const platformFee = Math.round(totalUnits * 2.5 * 100) / 100;
        const payoutFee = 3.0;
        const unitFee = Math.round(totalUnits * 2.5 * 100) / 100;
        const netPayout = Math.round((grossRent - processingFees - managementFee - expenses - platformFee - payoutFee) * 100) / 100;

        await db.ownerPayout.create({
          data: {
            ownerId: owner.id,
            landlordId: pm.id,
            periodStart: periodStart(currentMonth - m),
            periodEnd: periodEnd(currentMonth - m),
            grossRent,
            processingFees,
            managementFee,
            expenses,
            platformFee,
            netPayout: Math.max(netPayout, 0),
            payoutFee,
            unitFee,
            status: "PAID",
            paidAt: periodEnd(currentMonth - m),
            paymentMethod: "ach",
            notes: `Monthly payout for ${periodStart(currentMonth - m).toLocaleString("en-US", { month: "long", year: "numeric" })}`,
          },
        });
      }

      console.log(`    Owner "${owner.name}": Created ${monthsToGenerate} monthly payouts (${totalUnits} units)`);
    }

    // Create sample expenses for the first property of each PM
    const firstProperty = await db.property.findFirst({
      where: { landlordId: pm.id },
    });

    if (firstProperty) {
      const expenseTemplates = [
        { category: "MAINTENANCE", description: "Emergency plumbing repair - Unit 2A leak", amount: 450.0, daysAgo: 15 },
        { category: "MAINTENANCE", description: "HVAC filter replacement - all units", amount: 280.0, daysAgo: 30 },
        { category: "SERVICES", description: "Monthly landscaping service", amount: 350.0, daysAgo: 28 },
        { category: "SERVICES", description: "Pest control quarterly treatment", amount: 175.0, daysAgo: 45 },
        { category: "UPGRADES", description: "New washer/dryer unit - Unit 1B", amount: 1200.0, daysAgo: 60 },
        { category: "INSURANCE", description: "Property liability insurance Q1", amount: 850.0, daysAgo: 75 },
        { category: "TAXES", description: "Property tax payment Q1", amount: 2100.0, daysAgo: 80 },
        { category: "OTHER", description: "Lock replacement for main entry", amount: 125.0, daysAgo: 10 },
      ];

      const existingExpenses = await db.expense.count({
        where: {
          landlordId: pm.id,
          date: { gte: new Date(now.getFullYear(), 0, 1) },
        },
      });

      if (existingExpenses < 3) {
        for (const exp of expenseTemplates) {
          const expDate = new Date(now);
          expDate.setDate(expDate.getDate() - exp.daysAgo);

          await db.expense.create({
            data: {
              propertyId: firstProperty.id,
              landlordId: pm.id,
              category: exp.category as any,
              amount: exp.amount,
              date: expDate,
              description: exp.description,
              vendor: exp.category === "MAINTENANCE" ? "AllPro Maintenance" :
                exp.category === "SERVICES" ? "Green Thumb Landscaping" :
                  null,
            },
          });
        }
        console.log(`  ${pm.email}: Created ${expenseTemplates.length} sample expenses`);
      } else {
        console.log(`  ${pm.email}: Already has ${existingExpenses} expenses, skipping.`);
      }
    }
  }

  console.log("\n✅ Data tasks complete!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
