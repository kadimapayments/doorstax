import { requireRole } from "@/lib/auth-utils";
import { RiskDashboard } from "@/components/risk/risk-dashboard";

export const metadata = { title: "Risk — Dashboard" };

export default async function LandlordRiskPage() {
  await requireRole("PM");
  return <RiskDashboard />;
}
