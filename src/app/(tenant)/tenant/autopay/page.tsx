"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export default function AutopayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function enableAutopay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/autopay", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to enable autopay");
        return;
      }
      toast.success("Autopay enabled!");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function cancelAutopay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/autopay", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel autopay");
        return;
      }
      toast.success("Autopay cancelled");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autopay"
        description="Automatically pay rent each month."
      />

      <Card className="max-w-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            Recurring Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When autopay is enabled, your rent will be automatically charged on
            your due date each month using your saved payment method.
          </p>
          <p className="text-sm text-muted-foreground">
            You must have a payment method saved to your account before enabling
            autopay. Payment methods are tokenized and stored securely through
            Kadima.
          </p>
          <div className="flex gap-3">
            <Button onClick={enableAutopay} disabled={loading}>
              Enable Autopay
            </Button>
            <Button
              variant="outline"
              onClick={cancelAutopay}
              disabled={loading}
            >
              Cancel Autopay
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
