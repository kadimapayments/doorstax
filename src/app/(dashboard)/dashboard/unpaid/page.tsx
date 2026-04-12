export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { UnpaidRentDashboard } from "@/components/dashboard/unpaid-rent-dashboard";

export const metadata = { title: "Unpaid Rent" };

export default async function UnpaidRentPage() {
  await requireRole("PM");
  return <UnpaidRentDashboard />;
}
