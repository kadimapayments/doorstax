import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = await withCache("cache:admin:stats", 300, async () => {
    const [totalUsers, totalProperties, totalPayments] = await Promise.all([
      db.user.count(),
      db.property.count(),
      db.payment.count(),
    ]);
    return { totalUsers, totalProperties, totalPayments };
  });

  return NextResponse.json(stats);
}
