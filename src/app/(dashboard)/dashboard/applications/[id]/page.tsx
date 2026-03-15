"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus, Search, ExternalLink, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";

interface Application {
  id: string;
  unitId: string;
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

interface Screening {
  id: string;
  status: string;
  creditScore: number | null;
  creditResult: string | null;
  criminalResult: string | null;
  evictionResult: string | null;
  applyLink: string | null;
  requestedAt: string;
  completedAt: string | null;
}

interface ScreeningData {
  screenings: Screening[];
  configured: boolean;
}

function ResultIcon({ result }: { result: string | null }) {
  if (!result) return <span className="text-muted-foreground">—</span>;
  if (result === "PASS") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (result === "FAIL") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [screeningData, setScreeningData] = useState<ScreeningData | null>(null);
  const [requestingScreening, setRequestingScreening] = useState(false);

  const fetchScreenings = useCallback(() => {
    fetch("/api/screening")
      .then((r) => r.json())
      .then((data) => {
        // Filter to only screenings for this application
        const filtered = {
          ...data,
          screenings: (data.screenings || []).filter(
            (s: { applicationId?: string; application?: { id: string } }) =>
              s.applicationId === params.id || s.application?.id === params.id
          ),
        };
        setScreeningData(filtered);
      })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/applications/${params.id}`)
      .then((r) => r.json())
      .then(setApp);
    fetchScreenings();
  }, [params.id, fetchScreenings]);

  async function updateStatus(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    const res = await fetch(`/api/applications/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Application ${status.toLowerCase()}`);
      if (status === "APPROVED") {
        // Stay on page so the user can see the "Create Tenant" button
        setApp((prev) => prev ? { ...prev, status: "APPROVED" } : prev);
      } else {
        router.push("/dashboard/applications");
      }
    } else {
      toast.error("Failed to update");
    }
    setLoading(false);
  }

  async function requestScreening() {
    setRequestingScreening(true);
    try {
      const res = await fetch("/api/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: params.id }),
      });
      if (res.ok) {
        toast.success("Screening request sent");
        fetchScreenings();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to request screening");
      }
    } catch {
      toast.error("Failed to request screening");
    }
    setRequestingScreening(false);
  }

  if (!app) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const latestScreening = screeningData?.screenings?.[0];
  const hasActiveScreening = latestScreening && (latestScreening.status === "PENDING" || latestScreening.status === "IN_PROGRESS");
  const canRequestScreening = !hasActiveScreening;

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
            <div className="flex items-center gap-3">
              <StatusBadge status={app.status} />
              {app.status === "APPROVED" && (
                <Link
                  href={`/dashboard/tenants/add?name=${encodeURIComponent(app.name)}&email=${encodeURIComponent(app.email)}&phone=${encodeURIComponent(app.phone || "")}&unitId=${encodeURIComponent(app.unitId)}`}
                >
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Tenant from Application
                  </Button>
                </Link>
              )}
            </div>
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

      {/* Screening Section */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Tenant Screening
            </CardTitle>
            {canRequestScreening && (
              <Button
                size="sm"
                onClick={requestScreening}
                disabled={requestingScreening || (screeningData !== null && !screeningData.configured)}
                title={screeningData !== null && !screeningData.configured ? "Screening integration not configured" : undefined}
              >
                {requestingScreening ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Request Screening
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {screeningData !== null && !screeningData.configured && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
              RentSpree integration is not configured. Contact your administrator to enable screening.
            </p>
          )}

          {!latestScreening ? (
            <p className="text-sm text-muted-foreground">
              No screening has been requested for this applicant yet. Click &ldquo;Request Screening&rdquo; to send a credit & background check request via RentSpree. The applicant pays ~$40 for the screening.
            </p>
          ) : (
            <div className="space-y-4">
              {screeningData?.screenings?.map((s) => (
                <div key={s.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {s.status === "PENDING" && <Clock className="h-4 w-4 text-yellow-500" />}
                      {s.status === "IN_PROGRESS" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                      {s.status === "COMPLETED" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {s.status === "EXPIRED" && <XCircle className="h-4 w-4 text-gray-500" />}
                      {s.status === "CANCELLED" && <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-sm font-medium">
                        {s.status === "PENDING" && "Waiting for applicant"}
                        {s.status === "IN_PROGRESS" && "Screening in progress"}
                        {s.status === "COMPLETED" && "Screening complete"}
                        {s.status === "EXPIRED" && "Link expired"}
                        {s.status === "CANCELLED" && "Cancelled"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(new Date(s.requestedAt))}
                    </span>
                  </div>

                  {s.status === "COMPLETED" && (
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Credit</p>
                        <div className="flex items-center justify-center gap-1">
                          {s.creditScore && <span className="text-lg font-bold">{s.creditScore}</span>}
                          <ResultIcon result={s.creditResult} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Criminal</p>
                        <div className="flex items-center justify-center">
                          <ResultIcon result={s.criminalResult} />
                          {s.criminalResult && <span className="ml-1 text-sm">{s.criminalResult}</span>}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Eviction</p>
                        <div className="flex items-center justify-center">
                          <ResultIcon result={s.evictionResult} />
                          {s.evictionResult && <span className="ml-1 text-sm">{s.evictionResult}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {s.applyLink && (s.status === "PENDING" || s.status === "IN_PROGRESS") && (
                    <a
                      href={s.applyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on RentSpree <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
