"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, FileSpreadsheet, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function IntegrationsPage() {
  const [xeroNotified, setXeroNotified] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("xero-notify") === "true";
    }
    return false;
  });

  const [rentspreeNotified, setRentspreeNotified] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rentspree-notify") === "true";
    }
    return false;
  });

  function handleConnectQuickBooks() {
    window.location.href = "/api/integrations/quickbooks/connect";
  }

  function handleXeroNotify() {
    localStorage.setItem("xero-notify", "true");
    setXeroNotified(true);
    toast.success("You'll be notified when Xero integration is available!");
  }

  function handleRentspreeNotify() {
    localStorage.setItem("rentspree-notify", "true");
    setRentspreeNotified(true);
    toast.success("You'll be notified when RentSpree integration is available!");
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
                <Image src="/trust/quickbooks.png" alt="QuickBooks" width={40} height={40} className="rounded-lg" />
                QuickBooks Online
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Beta</Badge>
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
              <Button className="w-full" onClick={handleConnectQuickBooks}>
                Connect QuickBooks
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Requires QuickBooks Online account
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Xero Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-[#13B5EA]" />
                </div>
                Xero
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Connect your Xero account to automatically sync property income, expenses, and tenant invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Sync rent payments and receipts</li>
                <li>Automatic invoice generation</li>
                <li>Track property expenses by category</li>
                <li>Simplified tax-time reporting</li>
              </ul>
              {xeroNotified ? (
                <Button variant="outline" disabled className="w-full">
                  You will be notified
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleXeroNotify}>
                  Notify Me When Available
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RentSpree Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                RentSpree
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Streamline tenant screening with credit checks, background reports, and rental applications — all from one dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Credit and background screening</li>
                <li>Online rental applications</li>
                <li>Eviction history reports</li>
                <li>Applicant comparison tools</li>
              </ul>
              {rentspreeNotified ? (
                <Button variant="outline" disabled className="w-full">
                  You will be notified
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleRentspreeNotify}>
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
