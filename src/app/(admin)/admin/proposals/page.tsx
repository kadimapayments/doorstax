"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  SENT: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  OPENED: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  CLICKED: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  CONVERTED: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  EXPIRED: "bg-red-500/15 text-red-500 border-red-500/20",
};

export default function AdminProposalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/proposals")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Track pricing proposals sent to prospects — opens, clicks, and conversions."
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Total Sent" value={stats.total} />
          <Stat label="Opened" value={stats.opened} className="text-purple-500" />
          <Stat label="Clicked CTA" value={stats.clicked} className="text-amber-500" />
          <Stat label="Converted" value={stats.converted} className="text-emerald-500" />
          <Stat label="Open Rate" value={stats.openRate + "%"} />
          <Stat label="Conv. Rate" value={stats.conversionRate + "%"} className="text-emerald-500" />
          <Stat label="Pending" value={stats.sent} className="text-blue-500" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No proposals sent yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Profit Calculator to generate and email proposals.
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
                    <th className="text-left p-3">Prospect</th>
                    <th className="text-left p-3">Company</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Monthly Value</th>
                    <th className="text-left p-3">Agent</th>
                    <th className="text-left p-3">Sent</th>
                    <th className="text-center p-3">Status</th>
                    <th className="text-center p-3">Opens</th>
                    <th className="text-center p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-medium">{r.prospectName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.prospectEmail}
                        </div>
                        {r.leadId && (
                          <Link
                            href={"/admin/leads/" + r.leadId}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Lead: {r.leadName} ({r.leadStatus?.replace(/_/g, " ")})
                          </Link>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {r.prospectCompany || "—"}
                      </td>
                      <td className="p-3 text-right">{r.unitCount}</td>
                      <td className="p-3 text-right">
                        {formatCurrency(r.softwareCost)}
                      </td>
                      <td className="p-3">
                        <div className="text-xs">{r.agentName}</div>
                        {r.agentId && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {r.agentId}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.sentAt ? formatDate(r.sentAt) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            STATUS_CLASS[r.status] || STATUS_CLASS.DRAFT
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {r.openCount > 0 ? r.openCount : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {r.pdfUrl && (
                          <a
                            href={r.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            PDF
                          </a>
                        )}
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

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className={`text-xl font-bold mt-0.5 ${className || ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
