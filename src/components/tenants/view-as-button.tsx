"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export function ViewAsButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  async function handleViewAs() {
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });

    if (res.ok) {
      router.push("/tenant");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleViewAs}>
      <Eye className="mr-1 h-3 w-3" />
      View as
    </Button>
  );
}
