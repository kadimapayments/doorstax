import { requireRole } from "@/lib/auth-utils";
import { getTeamContext, can } from "@/lib/team-context";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheck, Plus } from "lucide-react";

export const metadata = { title: "Inspections" };

const TYPE_LABELS: Record<string, string> = {
  MOVE_IN: "Move-In",
  MOVE_OUT: "Move-Out",
  ROUTINE: "Routine",
  INITIAL: "Initial",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-500/10 text-blue-600",
  IN_PROGRESS: "bg-yellow-500/10 text-yellow-600",
  COMPLETED: "bg-emerald-500/10 text-emerald-600",
};

export default async function InspectionsPage() {
  const user = await requireRole("PM");
  const ctx = await getTeamContext(user.id);
  if (!can(ctx, "properties:read")) redirect("/dashboard");

  const inspections = await db.inspection.findMany({
    where: { property: { landlordId: ctx.landlordId } },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      inspector: { select: { name: true } },
      items: { select: { id: true, repairNeeded: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspections"
        description="Schedule and manage property inspections."
        actions={
          <Link href="/dashboard/inspections/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Inspection
            </Button>
          </Link>
        }
      />

      {inspections.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-12 w-12" />}
          title="No inspections yet"
          description="Schedule your first move-in, move-out, or routine inspection."
          action={
            <Link href="/dashboard/inspections/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Inspection
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Inspector</th>
                <th className="px-4 py-3 font-medium text-right">Items</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{i.property.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.unit?.unitNumber || "All"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                      {TYPE_LABELS[i.type] || i.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[i.status] || ""}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {i.scheduledAt ? new Date(i.scheduledAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i.inspector?.name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs">{i.items.length} items</span>
                    {i.items.some((it) => it.repairNeeded) && (
                      <span className="ml-1 text-xs text-red-500">({i.items.filter((it) => it.repairNeeded).length} repairs)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
