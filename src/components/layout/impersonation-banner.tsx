"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

interface ImpersonationData {
  tenantName: string;
  landlordName: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [data, setData] = useState<ImpersonationData | null>(null);

  useEffect(() => {
    // Read impersonation cookie
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("impersonating="));

    if (cookie) {
      try {
        const value = decodeURIComponent(cookie.split("=")[1]);
        setData(JSON.parse(value));
      } catch {
        // Invalid cookie
      }
    }
  }, []);

  if (!data) return null;

  async function handleExit() {
    await fetch("/api/impersonate", { method: "DELETE" });
    router.push("/dashboard/tenants");
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
      <Eye className="h-4 w-4" />
      <span>
        Viewing as <strong>{data.tenantName}</strong> — You are {data.landlordName}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 bg-white/80 hover:bg-white border-yellow-600 text-black"
        onClick={handleExit}
      >
        <X className="h-3 w-3 mr-1" />
        Exit
      </Button>
    </div>
  );
}
