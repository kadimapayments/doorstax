import { requireAdminPermission } from "@/lib/auth-utils";
import { PMProfileDetail } from "@/components/admin/pm-profile-detail";

export const metadata = { title: "PM Profile — Admin" };

export default async function AdminMerchantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:landlords");
  const { id } = await params;
  return <PMProfileDetail merchantAppId={id} />;
}
