export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { LeadDetailClient } from "./client";

export const metadata = { title: "Lead Detail" };

async function loadLead(id: string) {
  return db.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      },
      proposals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteId: true,
          unitCount: true,
          softwareCost: true,
          totalPaymentEarnings: true,
          netCostOrProfit: true,
          tierName: true,
          status: true,
          sentAt: true,
          openCount: true,
          clickedAt: true,
          convertedAt: true,
          pdfUrl: true,
          agentUser: { select: { name: true } },
        },
      },
    },
  });
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:leads");
  const { id } = await params;
  const lead = await loadLead(id);
  if (!lead) notFound();

  return <LeadDetailClient lead={JSON.parse(JSON.stringify(lead))} />;
}
