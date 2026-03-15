"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

export interface ImpersonationData {
  type?: string;
  tenantName?: string;
  landlordName?: string;
  landlordId?: string;
  adminId?: string;
  adminName?: string;
}

interface ImpersonationBannerProps {
  data?: ImpersonationData | null;
}

export function ImpersonationBanner({ data }: ImpersonationBannerProps) {
  const router = useRouter();

  if (!data) return null;

  async function handleExit() {
    await fetch("/api/impersonate", { method: "DELETE" });

    if (data?.adminId && data.type === "landlord") {
      router.push("/admin/landlords");
    } else if (data?.adminId && data.type === "tenant") {
      router.push("/admin/tenants");
    } else {
      router.push("/dashboard/tenants");
    }
  }

  // Determine display text
  let bannerText: React.ReactNode;
  if (data.adminId) {
    if (data.type === "landlord") {
      bannerText = (
        <>
          Viewing as <strong>{data.landlordName}</strong> (Manager) — You are{" "}
          {data.adminName}
        </>
      );
    } else if (data.type === "tenant") {
      bannerText = (
        <>
          Viewing as <strong>{data.tenantName}</strong> (Tenant) — You are{" "}
          {data.adminName}
        </>
      );
    }
  } else {
    bannerText = (
      <>
        Viewing as <strong>{data.tenantName}</strong> — You are{" "}
        {data.landlordName}
      </>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
      <Eye className="h-4 w-4" />
      <span>{bannerText}</span>
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
