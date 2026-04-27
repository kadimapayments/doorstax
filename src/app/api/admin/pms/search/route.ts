export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";

/**
 * GET /api/admin/pms/search?q=<query>
 *
 * Admin-scoped search for DoorStax's paying customers (PMs and
 * landlords). Used by the admin Virtual Terminal "Bill PM/Landlord"
 * tab so a DoorStax operator can find a specific PM and settle their
 * outstanding BillingInvoice rows.
 *
 * Mirrors the shape of /api/admin/tenants/search (which this file
 * effectively replaces in the admin-VT flow). Searches name, email,
 * and companyName via case-insensitive contains.
 *
 * Returns the PM's:
 *   - id / name / email / companyName / role
 *   - kadimaCardTokenId + pmCardBrand + pmCardLast4 (for the Charge
 *     Now button to know whether the PM has a billing card on file —
 *     the underlying /api/admin/billing/[invoiceId] endpoint also
 *     guards this, but we surface it in search results so the UI can
 *     disable the button proactively)
 *   - openInvoiceCount: how many PENDING/FAILED BillingInvoice rows
 *     the operator should review (drives the badge in search results)
 *
 * Gated by `admin:payments`. Rate-limited via the standard admin
 * payment limiter (matches the equivalent guard on the old
 * /api/admin/tenants/search route).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ pms: [] });

  // Search across the two paying-customer roles only. Excludes ADMIN /
  // OWNER / PARTNER / VENDOR — those aren't billed via BillingInvoice.
  const users = await db.user.findMany({
    where: {
      role: { in: ["PM", "LANDLORD"] },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      role: true,
      kadimaCustomerId: true,
      kadimaCardTokenId: true,
      pmCardBrand: true,
      pmCardLast4: true,
      // Pull the count of open invoices so the result row can show
      // "3 open" badges. Limited to PENDING + FAILED statuses (the
      // ones the Charge Now action accepts).
      _count: {
        select: {
          billingInvoices: {
            where: {
              status: { in: ["PENDING", "FAILED"] },
            },
          },
        },
      },
    },
    take: 25,
    orderBy: [
      // Prefer customers with open invoices first — most useful for
      // the operator scanning results.
      { billingInvoices: { _count: "desc" } },
      { name: "asc" },
    ],
  });

  const results = users.map((u) => ({
    id: u.id,
    name: u.name || "Unnamed",
    email: u.email,
    companyName: u.companyName,
    role: u.role,
    savedCard:
      u.kadimaCardTokenId && u.pmCardLast4
        ? { brand: u.pmCardBrand, last4: u.pmCardLast4 }
        : null,
    openInvoiceCount: u._count?.billingInvoices ?? 0,
  }));

  return NextResponse.json({ pms: results });
}
