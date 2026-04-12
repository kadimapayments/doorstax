"use client";

export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/ui/page-header";
import { NotificationsList } from "@/components/notifications/notifications-list";

export default function TenantNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="View your notifications." />
      <NotificationsList />
    </div>
  );
}
