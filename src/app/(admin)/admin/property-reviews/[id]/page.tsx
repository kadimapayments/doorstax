"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  NEEDS_INFO: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-600 border-red-500/20",
};

function fmt(v: any, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function fmtYesNo(v: boolean | null | undefined) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMoney(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return formatCurrency(Number(v));
}

export default function AdminPropertyReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<null | "approve" | "reject" | "request-info">(
    null
  );
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/property-reviews/${id}`);
      if (res.ok) {
        const body = await res.json();
        setData(body);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to load property");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAction(action: "approve" | "reject" | "request-info") {
    if ((action === "reject" || action === "request-info") && !notes.trim()) {
      toast.error(
        action === "reject"
          ? "Enter a reason before rejecting"
          : "Enter what you need from the PM"
      );
      return;
    }
    if (
      action === "reject" &&
      !window.confirm(
        `Reject "${data?.property?.name}"? The PM will be notified with the reason and the property won't process live payments.`
      )
    ) {
      return;
    }
    setActing(action);
    try {
      const res = await fetch(`/api/admin/property-reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(
        action === "approve"
          ? "Property approved"
          : action === "reject"
            ? "Property rejected"
            : "Info requested from PM"
      );
      setNotes("");
      await load();
      if (action === "approve") {
        router.push("/admin/property-reviews");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6 page-enter">
        <PageHeader title="Loading property…" />
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  const p = data.property;
  const merchantApp = data.merchantApp;
  const isFinal = p.boardingStatus === "APPROVED" || p.boardingStatus === "REJECTED";

  return (
    <div className="space-y-6 page-enter">
      <Link
        href="/admin/property-reviews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>

      <PageHeader
        title={p.name}
        description={`${p.address}, ${p.city}, ${p.state} ${p.zip}`}
        actions={
          <a
            href={`/api/properties/${p.id}/profile.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </a>
        }
      />

      {/* Status + PM strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Status
            </div>
            <Badge
              variant="outline"
              className={STATUS_BADGE[p.boardingStatus] || STATUS_BADGE.PENDING_REVIEW}
            >
              {p.boardingStatus === "PENDING_REVIEW" && <Clock className="h-3 w-3 mr-1" />}
              {p.boardingStatus === "NEEDS_INFO" && <AlertCircle className="h-3 w-3 mr-1" />}
              {p.boardingStatus === "APPROVED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {p.boardingStatus === "REJECTED" && <XCircle className="h-3 w-3 mr-1" />}
              {p.boardingStatus.replace(/_/g, " ")}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Submitted {fmtDate(p.submittedForReviewAt)}
            </p>
            {p.reviewedAt && (
              <p className="text-[11px] text-muted-foreground">
                Last reviewed {fmtDate(p.reviewedAt)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              PM
            </div>
            <div className="font-medium">
              {p.landlord?.companyName || p.landlord?.name || "—"}
            </div>
            <div className="text-xs text-muted-foreground">{p.landlord?.email}</div>
            {p.landlord?.phone && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {p.landlord.phone}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">
              Tier: {p.landlord?.currentTier || "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Merchant app
            </div>
            <div className="font-medium">
              {merchantApp?.status || "Not started"}
            </div>
            {merchantApp?.kadimaAppId && (
              <div className="text-[11px] text-muted-foreground mt-1">
                Kadima app: <span className="font-mono">{merchantApp.kadimaAppId}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Existing review notes */}
      {p.reviewNotes && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Prior underwriter notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{p.reviewNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Building profile */}
      <Section title="Building profile">
        <Row k="Type" v={fmt(p.propertyType)} />
        <Row k="Year built" v={fmt(p.yearBuilt)} />
        <Row k="Total sqft" v={fmt(p.totalSqft)} />
        <Row k="Stories" v={fmt(p.storyCount)} />
        <Row k="Construction" v={fmt(p.constructionType)} />
        <Row k="Elevator" v={fmtYesNo(p.hasElevator)} />
        <Row k="On-site laundry" v={fmtYesNo(p.hasOnsiteLaundry)} />
        <Row k="Parking spaces" v={fmt(p.parkingSpaces)} />
        <Row k="Parking type" v={fmt(p.parkingType)} />
      </Section>

      {/* Unit mix */}
      <Section title="Unit mix">
        <Row k="Residential units" v={fmt(p.residentialUnitCount)} />
        <Row k="Commercial units" v={fmt(p.commercialUnitCount)} />
        {p.commercialFloors && (
          <Row k="Commercial floors" v={p.commercialFloors} />
        )}
        <Row k="Section 8 / subsidized" v={fmt(p.section8UnitCount ?? 0)} />
        <Row k="Zoning" v={fmt(p.zoning)} />
        <Row k="Parcel number (APN)" v={fmt(p.parcelNumber)} />
      </Section>

      {p.units?.length > 0 && (
        <Section title={`Units on file (${p.units.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left p-2">Unit</th>
                  <th className="text-right p-2">Beds</th>
                  <th className="text-right p-2">Baths</th>
                  <th className="text-right p-2">Sqft</th>
                  <th className="text-right p-2">Rent</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {p.units.map((u: any) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{u.unitNumber}</td>
                    <td className="p-2 text-right">{fmt(u.bedrooms)}</td>
                    <td className="p-2 text-right">{fmt(u.bathrooms)}</td>
                    <td className="p-2 text-right">{fmt(u.sqft)}</td>
                    <td className="p-2 text-right">
                      {u.rentAmount != null ? formatCurrency(Number(u.rentAmount)) : "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {fmt(u.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Financial */}
      <Section title="Financial">
        <Row k="Purchase price" v={fmtMoney(p.purchasePrice)} />
        <Row k="Purchase date" v={fmtDate(p.purchaseDate)} />
        <Row k="Annual property tax" v={fmtMoney(p.annualPropertyTax)} />
        <Row k="Expected monthly rent roll" v={fmtMoney(p.expectedMonthlyRentRoll)} />
        <Row k="Mortgage / lien holder" v={fmt(p.mortgageHolder)} />
        <Row k="Insurance carrier" v={fmt(p.insuranceCarrier)} />
        <Row k="Insurance policy #" v={fmt(p.insurancePolicyNumber)} />
      </Section>

      {/* Owner */}
      {p.owner && (
        <Section title="Owner">
          <Row k="Name" v={fmt(p.owner.name)} />
          <Row k="Email" v={fmt(p.owner.email)} />
          <Row k="Phone" v={fmt(p.owner.phone)} />
          <Row
            k="Management fee"
            v={
              p.owner.managementFeePercent != null
                ? `${Number(p.owner.managementFeePercent).toFixed(2)}%`
                : "—"
            }
          />
        </Section>
      )}

      {/* Documents */}
      <Section title={`Documents (${p.documents?.length || 0})`}>
        {(!p.documents || p.documents.length === 0) ? (
          <p className="text-xs text-muted-foreground">
            No documents uploaded.
          </p>
        ) : (
          <ul className="space-y-2">
            {p.documents.map((d: any) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate block hover:underline"
                    >
                      {d.fileName}
                    </a>
                    <p className="text-[11px] text-muted-foreground">
                      {d.type}
                      {d.label ? ` · ${d.label}` : ""} ·{" "}
                      {(d.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {fmtDate(d.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Action bar */}
      {!isFinal && (
        <Card className="border-border sticky bottom-4 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium">
                Decision notes{" "}
                <span className="text-muted-foreground">
                  (required for Reject and Request info)
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional for approval. Required when rejecting or asking for more info — the PM sees this verbatim."
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleAction("request-info")}
                disabled={!!acting}
              >
                {acting === "request-info" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Request info
              </Button>
              <Button
                variant="outline"
                className="border-red-500/40 text-red-600 hover:bg-red-500/10"
                onClick={() => handleAction("reject")}
                disabled={!!acting}
              >
                {acting === "reject" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => handleAction("approve")}
                disabled={!!acting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {acting === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <div className="grid gap-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{k}</span>
      <span className="text-right break-words">{v}</span>
    </div>
  );
}
