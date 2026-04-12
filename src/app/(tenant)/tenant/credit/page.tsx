"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  TrendingUp,
  CheckCircle2,
  Shield,
  Clock,
  CreditCard,
  XCircle,
} from "lucide-react";

export default function CreditBuildingPage() {
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch("/api/tenants/credit-reporting")
      .then((r) => r.json())
      .then((data) => {
        setEnrolled(data.creditReportingEnrolled || false);
        setEnrolledAt(data.creditReportingEnrolledAt || null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleEnroll() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants/credit-reporting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEnrolled(data.creditReportingEnrolled);
      setEnrolledAt(data.creditReportingEnrolledAt);
      toast.success("Successfully enrolled in credit reporting!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnenroll() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants/credit-reporting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unenroll" }),
      });
      if (!res.ok) throw new Error("Failed");
      setEnrolled(false);
      setEnrolledAt(null);
      toast.success("Credit reporting has been cancelled.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/tenant"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>

      <PageHeader
        title="Credit Building"
        description="Build your credit score by reporting on-time rent payments."
      />

      {/* Status Card */}
      <Card className="border-border">
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Credit Reporting Status</p>
              {enrolled && enrolledAt && (
                <p className="text-xs text-muted-foreground">
                  Enrolled since {new Date(enrolledAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              enrolled
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }
          >
            {enrolled ? "Enrolled" : "Not Enrolled"}
          </Badge>
        </CardContent>
      </Card>

      {enrolled ? (
        /* Already Enrolled */
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">You&apos;re Enrolled!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p>Your qualifying on-time rent payments are being reported to help build your credit profile.</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <p>Reports are submitted monthly through our third-party credit reporting partner.</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Shield className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                <p>Continue making on-time payments to maximize the benefit to your credit score.</p>
              </div>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnenroll}
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Cancel Credit Reporting"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Not Enrolled — Show enrollment flow */
        <>
          {/* Benefits */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                How Credit Building Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Build Credit History</p>
                    <p className="text-xs text-muted-foreground">
                      On-time rent payments may help build your credit profile over time.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Third-Party Reporting</p>
                    <p className="text-xs text-muted-foreground">
                      Reporting is handled through a trusted third-party credit bureau partner.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    <CreditCard className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No Extra Cost</p>
                    <p className="text-xs text-muted-foreground">
                      Credit reporting is included at no additional charge to you.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <XCircle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cancel Anytime</p>
                    <p className="text-xs text-muted-foreground">
                      This is completely optional. You can unenroll at any time from this page.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrollment */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                Enroll in Credit Reporting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
                <p>By enrolling, you agree to the following:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>DoorStax will report your qualifying rent payment history to credit bureaus through a third-party reporting partner.</li>
                  <li>You consent to identity verification as required by the reporting process.</li>
                  <li>This service is optional and can be cancelled at any time.</li>
                  <li>Late or missed payments may also be reported, which could negatively impact your credit.</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input"
                />
                <span className="text-sm">
                  I understand and agree to the credit reporting terms above.
                </span>
              </label>
              <Button
                className="gradient-bg w-full"
                disabled={!agreed || submitting}
                onClick={handleEnroll}
              >
                {submitting ? "Enrolling..." : "Enroll in Credit Reporting"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
