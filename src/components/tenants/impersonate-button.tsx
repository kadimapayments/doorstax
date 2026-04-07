"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export function ImpersonateButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        router.push("/tenant");
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <Eye className="mr-1.5 h-3.5 w-3.5" />
      {loading ? "Loading..." : "View As Tenant"}
    </Button>
  );
}
