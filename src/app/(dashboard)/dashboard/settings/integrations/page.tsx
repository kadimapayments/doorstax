"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function IntegrationsPage() {
  const [notified, setNotified] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("qb-notify") === "true";
    }
    return false;
  });

  function handleNotify() {
    localStorage.setItem("qb-notify", "true");
    setNotified(true);
    toast.success("You'll be notified when QuickBooks integration is available!");
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Settings
      </Link>

      <PageHeader
        title="Integrations"
        description="Connect DoorStax with your favorite tools."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* QuickBooks Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                {/* QuickBooks Icon - green circle with QB */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">QB</span>
                </div>
                QuickBooks Online
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Automatically sync payments, invoices, and tenant records to QuickBooks for seamless accounting reconciliation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Auto-sync rent payments as journal entries</li>
                <li>Create invoices for upcoming rent</li>
                <li>Track tenant balances and receivables</li>
                <li>Generate financial reports for tax season</li>
              </ul>
              {notified ? (
                <Button variant="outline" disabled className="w-full">
                  You will be notified
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleNotify}>
                  Notify Me When Available
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Future Integrations Placeholder */}
        <Card className="border-border border-dashed">
          <CardContent className="flex h-full min-h-[200px] flex-col items-center justify-center text-center p-6">
            <p className="text-sm text-muted-foreground">
              More integrations coming soon.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Zapier, Google Workspace, and more.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
