"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, FileSpreadsheet } from "lucide-react";

export default function TenantReportsPage() {
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), 1);

  const [from, setFrom] = useState(threeYearsAgo.toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  function download(format: string) {
    window.open(`/api/reports?format=${format}&from=${from}&to=${to}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Download your rent payment history." />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle>Payment History Report</CardTitle>
          <CardDescription>
            Download a report of all your payments. You can view up to 3 years of history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
              setTo(now.toISOString().split("T")[0]);
            }}>
              This Month
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setFrom(new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]);
              setTo(now.toISOString().split("T")[0]);
            }}>
              This Year
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setFrom(threeYearsAgo.toISOString().split("T")[0]);
              setTo(now.toISOString().split("T")[0]);
            }}>
              Last 3 Years
            </Button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => download("csv")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
            <Button variant="outline" onClick={() => download("pdf")}>
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
