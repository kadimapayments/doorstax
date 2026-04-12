export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, ExternalLink, AlertCircle } from "lucide-react";
import { isRentSpreeConfigured } from "@/lib/rentspree";
import Link from "next/link";

export const metadata = { title: "Screening" };

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  EXPIRED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const resultColors: Record<string, string> = {
  PASS: "text-green-600 dark:text-green-400",
  REVIEW: "text-yellow-600 dark:text-yellow-400",
  FAIL: "text-red-600 dark:text-red-400",
};

export default async function ScreeningPage() {
  const user = await requireRole("PM");
  const landlordId = await getEffectiveLandlordId(user.id);
  const configured = isRentSpreeConfigured();

  const screenings = await db.tenantScreening.findMany({
    where: { landlordId },
    include: {
      application: {
        select: {
          id: true,
          name: true,
          email: true,
          unit: {
            select: {
              unitNumber: true,
              property: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Screening"
        description="Credit checks and background screenings powered by RentSpree."
      />

      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/30">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Integration Not Configured</p>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
              RentSpree API credentials are not set. Contact your administrator to enable tenant screening.
              Screening requests will be saved but not processed until the integration is configured.
            </p>
          </div>
        </div>
      )}

      {screenings.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="No screening requests"
          description="Screening requests will appear here when you request tenant background checks from application pages."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Applicant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property / Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Credit</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Criminal</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Eviction</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Requested</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {screenings.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          href={`/dashboard/applications/${s.application.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {s.application.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{s.application.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.application.unit.property.name} — Unit {s.application.unit.unitNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s.status] || ""}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "COMPLETED" ? (
                        <div>
                          {s.creditScore && <span className="font-semibold">{s.creditScore}</span>}
                          {s.creditResult && (
                            <span className={`ml-1 text-xs font-medium ${resultColors[s.creditResult] || ""}`}>
                              {s.creditResult}
                            </span>
                          )}
                          {!s.creditScore && !s.creditResult && <span className="text-muted-foreground">—</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "COMPLETED" && s.criminalResult ? (
                        <span className={`text-xs font-medium ${resultColors[s.criminalResult] || ""}`}>
                          {s.criminalResult}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "COMPLETED" && s.evictionResult ? (
                        <span className={`text-xs font-medium ${resultColors[s.evictionResult] || ""}`}>
                          {s.evictionResult}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(s.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.applyLink && s.status !== "COMPLETED" && (
                        <a
                          href={s.applyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
