"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ScreeningRow {
  id: string;
  email: string;
  status: string;
  pmName: string;
  pmCompany: string | null;
  property: string;
  unit: string;
  sentAt: string;
}

const STATUS_CLASS: Record<string, string> = {
  SENT: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  OPENED: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  COMPLETED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
};

export default function AdminScreeningsPage() {
  const [rows, setRows] = useState<ScreeningRow[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/screenings")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows || []);
        setStats(d.stats || null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screenings"
        description="All RentSpree screening invitations across the platform."
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total },
            { label: "Sent", value: stats.sent, tone: "amber" },
            { label: "Opened", value: stats.opened, tone: "blue" },
            { label: "Completed", value: stats.completed, tone: "green" },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No screenings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Screening invitations from PMs will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-3">Applicant</th>
                    <th className="text-left p-3">PM</th>
                    <th className="text-left p-3">Property / Unit</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-left p-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{r.email}</td>
                      <td className="p-3">
                        <div className="text-sm">{r.pmName}</div>
                        {r.pmCompany && (
                          <div className="text-xs text-muted-foreground">
                            {r.pmCompany}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {r.property} &mdash; {r.unit}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            STATUS_CLASS[r.status] || STATUS_CLASS.SENT
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {formatDate(r.sentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
