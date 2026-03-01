"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Ticket } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface TicketItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  unit: { unitNumber: string; property: { name: string } };
}

export default function TenantTicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);

  useEffect(() => {
    fetch("/api/tickets")
      .then((r) => r.json())
      .then((data) => setTickets(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Tickets"
        description="Submit and track maintenance requests."
        actions={
          <Link href="/tenant/tickets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </Link>
        }
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-12 w-12" />}
          title="No tickets"
          description="Submit a service ticket if you need maintenance or have an issue."
          action={
            <Link href="/tenant/tickets/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} &middot; {formatDate(new Date(t.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
