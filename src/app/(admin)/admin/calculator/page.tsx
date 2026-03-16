import { requireAdminPermission } from "@/lib/auth-utils";
import { ProfitCalculator } from "@/components/admin/profit-calculator";

export const metadata = { title: "Profit Calculator" };

export default async function CalculatorPage() {
  await requireAdminPermission("admin:overview");

  return <ProfitCalculator />;
}
