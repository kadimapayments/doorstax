"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  employment: string;
  employer: string | null;
  income: string;
  rentalHistory: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  unit: {
    unitNumber: string;
    rentAmount: string;
    property: { name: string; address: string };
  };
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/applications/${params.id}`)
      .then((r) => r.json())
      .then(setApp);
  }, [params.id]);

  async function updateStatus(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    const res = await fetch(`/api/applications/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Application ${status.toLowerCase()}`);
      router.push("/dashboard/applications");
    } else {
      toast.error("Failed to update");
    }
    setLoading(false);
  }

  if (!app) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.name}
        description={`Applied for Unit ${app.unit.unitNumber} at ${app.unit.property.name}`}
        actions={
          app.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button
                onClick={() => updateStatus("APPROVED")}
                disabled={loading}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => updateStatus("REJECTED")}
                disabled={loading}
              >
                Reject
              </Button>
            </div>
          ) : (
            <StatusBadge status={app.status} />
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Applicant Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{app.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{app.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employment</span>
              <span>{app.employment}</span>
            </div>
            {app.employer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employer</span>
                <span>{app.employer}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium">
                {formatCurrency(Number(app.income))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Applied</span>
              <span>{formatDate(new Date(app.createdAt))}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Unit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property</span>
              <span>{app.unit.property.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unit</span>
              <span>{app.unit.unitNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rent</span>
              <span className="font-medium">
                {formatCurrency(Number(app.unit.rentAmount))}/mo
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
