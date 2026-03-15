import { requireRole } from "@/lib/auth-utils";
import { WhiteLabelManagement } from "@/components/admin/white-label-management";

export const metadata = { title: "White Label Partners — Admin" };

export default async function AdminWhiteLabelPage() {
  await requireRole("ADMIN");

  return <WhiteLabelManagement />;
}
