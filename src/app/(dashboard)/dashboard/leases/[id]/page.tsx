"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, FileText, RefreshCw, XCircle, Pencil, CheckCircle2, PenTool, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { RentAdjustmentDialog } from "@/components/dashboard/rent-adjustment-dialog";

interface Addendum {
  id: string;
  type: string;
  newRentAmount: string | number | null;
  newEndDate: string | null;
  notes: string | null;
  documentUrl: string | null;
  createdAt: string;
}

interface RentHistoryEntry {
  id: string;
  previousAmount: string | number;
  newAmount: string | number;
  changePercent: number;
  changeType: string;
  effectiveDate: string;
  noticeDate: string | null;
  noticePeriodDays: number | null;
  jurisdiction: string | null;
  complianceAck: boolean;
  complianceNote: string | null;
  reason: string | null;
  changedById: string;
  changedBy?: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
}

interface LeaseDetail {
  id: string;
  tenantId: string;
  rentAmount: string | number;
  startDate: string;
  endDate: string | null;  // null = month-to-month after endDate went nullable
  status: string;
  documentUrl: string | null;
  notes: string | null;
  createdAt: string;
  signedByTenant: boolean;
  signedByLandlord: boolean;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  tenant: { user: { name: string; email: string } };
  unit: {
    unitNumber: string;
    rentAmount: string | number;
    property: { name: string; rentControlJurisdiction?: string | null };
  };
  property: { name: string };
  addendums: Addendum[];
  rentHistory: RentHistoryEntry[];
}

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lease, setLease] = useState<LeaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  // Addendum dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addendumType, setAddendumType] = useState<"RENEWAL" | "TERMINATION" | "AMENDMENT">("RENEWAL");
  const [newRent, setNewRent] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [addendumNotes, setAddendumNotes] = useState("");
  const [addendumDoc, setAddendumDoc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState(false);

  // Rent adjustment dialog state — dedicated rent-only flow with
  // compliance acknowledgement + tenant email notice.
  const [rentAdjustOpen, setRentAdjustOpen] = useState(false);

  async function fetchLease() {
    try {
      const r = await fetch(`/api/leases/${id}`);
      const data = await r.json();
      setLease(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLease();
  }, [id]);

  function openAddendumDialog(type: "RENEWAL" | "TERMINATION" | "AMENDMENT") {
    setAddendumType(type);
    setNewRent(type === "RENEWAL" ? String(Number(lease?.rentAmount || 0)) : "");
    setNewEndDate("");
    setAddendumNotes("");
    setAddendumDoc("");
    setDialogOpen(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "leases");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setAddendumDoc(data.url);
        toast.success("Document uploaded");
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddendumSubmit() {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        type: addendumType,
        notes: addendumNotes || undefined,
        documentUrl: addendumDoc || undefined,
      };

      if (addendumType !== "TERMINATION" && newRent) {
        payload.newRentAmount = Number(newRent);
      }
      if (newEndDate) {
        payload.newEndDate = newEndDate;
      }

      const res = await fetch(`/api/leases/${id}/addendum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create addendum");
        setSubmitting(false);
        return;
      }

      toast.success(
        addendumType === "RENEWAL"
          ? "Lease renewed!"
          : addendumType === "TERMINATION"
          ? "Lease terminated"
          : "Amendment added"
      );
      setDialogOpen(false);

      // Refresh lease data
      const updated = await fetch(`/api/leases/${id}`).then((r) => r.json());
      setLease(updated);

      // If renewed, redirect to the new lease
      if (addendumType === "RENEWAL") {
        const result = await res.json().catch(() => null);
        if (result?.newLease?.id) {
          router.push(`/dashboard/leases/${result.newLease.id}`);
          return;
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignAsManager() {
    setSigning(true);
    try {
      const res = await fetch(`/api/leases/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "landlord" }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to sign lease");
        return;
      }

      toast.success("Lease signed successfully");
      await fetchLease();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSigning(false);
    }
  }

  function handleRequestTenantSignature() {
    toast.success("Signature request sent to tenant");
  }

  async function handleActivateLease() {
    setActivating(true);
    try {
      const res = await fetch(`/api/leases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to activate lease");
        return;
      }

      toast.success("Lease activated successfully");
      await fetchLease();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground">Loading lease details...</div>
    );
  }

  if (!lease) {
    return (
      <div className="p-6 text-muted-foreground">Lease not found.</div>
    );
  }

  const isPending = lease.status === "PENDING";
  const isActive = lease.status === "ACTIVE" || lease.status === "MONTH_TO_MONTH";
  const fullyExecuted = lease.signedByLandlord && lease.signedByTenant;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/leases"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Leases
      </Link>

      <PageHeader
        title={`Lease — ${lease.tenant.user.name}`}
        description={`${lease.property.name} · Unit ${lease.unit.unitNumber}`}
        actions={
          isPending ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleActivateLease}
                disabled={activating}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {activating ? "Activating..." : "Activate Lease"}
              </Button>
            </div>
          ) : isActive ? (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRentAdjustOpen(true)}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Adjust Rent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddendumDialog("AMENDMENT")}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Amend
              </Button>
              <Button
                size="sm"
                onClick={() => openAddendumDialog("RENEWAL")}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Renew
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => openAddendumDialog("TERMINATION")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Terminate
              </Button>
            </div>
          ) : null
        }
      />

      {/* Lease Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Lease Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={lease.status} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tenant</span>
              <span>{lease.tenant.user.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span>{lease.tenant.user.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span className="font-semibold">
                {formatCurrency(Number(lease.rentAmount))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lease Period</span>
              <span>
                {formatDate(new Date(lease.startDate))} —{" "}
                {lease.endDate
                  ? formatDate(new Date(lease.endDate))
                  : "Month-to-month"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(new Date(lease.createdAt))}</span>
            </div>
            {lease.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm mt-1">{lease.notes}</p>
              </div>
            )}
            {lease.documentUrl && (
              <div className="pt-2 border-t border-border">
                <a
                  href={lease.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  View Lease Document
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rent History — first-class audit trail from RentChangeHistory. */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Rent History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(lease.rentHistory?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rent changes recorded for this lease yet.
              </p>
            ) : (
              <div className="space-y-3">
                {lease.rentHistory.map((rh) => {
                  const up = rh.changeType === "INCREASE";
                  const down = rh.changeType === "DECREASE";
                  return (
                    <div
                      key={rh.id}
                      className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm tabular-nums">
                          {formatCurrency(Number(rh.previousAmount))}
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-semibold">
                            {formatCurrency(Number(rh.newAmount))}
                          </span>
                          <span
                            className={`ml-2 inline-flex items-center gap-0.5 text-xs ${
                              up
                                ? "text-amber-600"
                                : down
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {up && <TrendingUp className="h-3 w-3" />}
                            {down && <TrendingDown className="h-3 w-3" />}
                            {rh.changePercent >= 0 ? "+" : ""}
                            {rh.changePercent.toFixed(1)}%
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {rh.reason || rh.changeType}
                          {" · Effective "}
                          {formatDate(new Date(rh.effectiveDate))}
                          {rh.jurisdiction && rh.jurisdiction !== "NONE" && (
                            <> · {rh.jurisdiction}</>
                          )}
                          {rh.changedBy?.name && (
                            <> · by {rh.changedBy.name}</>
                          )}
                        </p>
                        {rh.complianceNote && (
                          <p className="text-[11px] text-muted-foreground mt-1 italic">
                            &ldquo;{rh.complianceNote}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(new Date(rh.createdAt))}
                        </p>
                        {rh.complianceAck ? (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            ✓ Compliance ack
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">
                            ⚠ Unflagged
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Addendum History */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Addendum History</CardTitle>
          </CardHeader>
          <CardContent>
            {lease.addendums.length === 0 ? (
              <p className="text-sm text-muted-foreground">No addendums.</p>
            ) : (
              <div className="space-y-4">
                {lease.addendums.map((a) => (
                  <div
                    key={a.id}
                    className="border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between">
                      <StatusBadge status={a.type} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(a.createdAt))}
                      </span>
                    </div>
                    {a.newRentAmount && (
                      <p className="mt-1 text-sm">
                        New Rent:{" "}
                        <span className="font-medium">
                          {formatCurrency(Number(a.newRentAmount))}
                        </span>
                      </p>
                    )}
                    {a.newEndDate && (
                      <p className="text-sm">
                        New End Date:{" "}
                        <span className="font-medium">
                          {formatDate(new Date(a.newEndDate))}
                        </span>
                      </p>
                    )}
                    {a.notes && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.notes}
                      </p>
                    )}
                    {a.documentUrl && (
                      <a
                        href={a.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        Document
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* E-Signatures */}
        <Card className="border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              E-Signatures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fullyExecuted && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Fully Executed
                </span>
              </div>
            )}

            {/* Landlord Signature */}
            <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">Landlord / Manager</p>
                {lease.signedByLandlord ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">
                      Signed on {formatDate(new Date(lease.landlordSignedAt!))}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Not yet signed</p>
                )}
              </div>
              {!lease.signedByLandlord && (
                <Button
                  size="sm"
                  onClick={handleSignAsManager}
                  disabled={signing}
                >
                  <PenTool className="mr-2 h-4 w-4" />
                  {signing ? "Signing..." : "Sign as Manager"}
                </Button>
              )}
            </div>

            {/* Tenant Signature */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Tenant</p>
                {lease.signedByTenant ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">
                      Signed on {formatDate(new Date(lease.tenantSignedAt!))}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Awaiting tenant signature</p>
                )}
              </div>
              {!lease.signedByTenant && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestTenantSignature}
                >
                  Request Signature
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Addendum Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addendumType === "RENEWAL"
                ? "Renew Lease"
                : addendumType === "TERMINATION"
                ? "Terminate Lease"
                : "Amend Lease"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* New Rent (not for termination) */}
            {addendumType !== "TERMINATION" && (
              <div className="space-y-2">
                <Label htmlFor="newRent">
                  {addendumType === "RENEWAL"
                    ? "New Monthly Rent ($)"
                    : "Updated Rent (optional)"}
                </Label>
                <Input
                  id="newRent"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRent}
                  onChange={(e) => setNewRent(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </div>
            )}

            {/* New End Date */}
            <div className="space-y-2">
              <Label htmlFor="newEndDate">
                {addendumType === "RENEWAL"
                  ? "New End Date"
                  : addendumType === "TERMINATION"
                  ? "Termination Date"
                  : "Updated End Date (optional)"}
              </Label>
              <Input
                id="newEndDate"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="addendumNotes">Notes (optional)</Label>
              <textarea
                id="addendumNotes"
                value={addendumNotes}
                onChange={(e) => setAddendumNotes(e.target.value)}
                placeholder="Additional notes..."
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <Label>Document (optional)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading && (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              )}
              {addendumDoc && (
                <p className="text-xs text-emerald-500">Document uploaded ✓</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={addendumType === "TERMINATION" ? "destructive" : "default"}
                onClick={handleAddendumSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "Processing..."
                  : addendumType === "RENEWAL"
                  ? "Renew Lease"
                  : addendumType === "TERMINATION"
                  ? "Terminate Lease"
                  : "Save Amendment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rent adjustment dialog — dedicated rent-only flow with
         compliance acknowledgement + tenant email notice. */}
      <RentAdjustmentDialog
        open={rentAdjustOpen}
        onOpenChange={setRentAdjustOpen}
        leaseId={lease.id}
        currentRent={Number(lease.rentAmount)}
        propertyName={lease.property?.name || lease.unit?.property?.name || ""}
        unitNumber={lease.unit?.unitNumber || ""}
        tenantName={lease.tenant?.user?.name || ""}
        jurisdiction={lease.unit?.property?.rentControlJurisdiction || null}
        onSuccess={fetchLease}
      />
    </div>
  );
}
