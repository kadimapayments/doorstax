import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getTeamContext } from "@/lib/team-context";
import { EARNINGS_UNLOCK_UNITS } from "@/lib/constants";
import { LockedEarnings } from "./locked";
import ResidualsClient from "./residuals-client";

export const metadata = { title: "Earnings" };

export default async function ResidualsPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);

  const unitCount = await db.unit.count({
    where: { property: { landlordId: ctx.landlordId } },
  });

  if (unitCount < EARNINGS_UNLOCK_UNITS) {
    return <LockedEarnings unitCount={unitCount} />;
  }

  return <ResidualsClient />;
}
