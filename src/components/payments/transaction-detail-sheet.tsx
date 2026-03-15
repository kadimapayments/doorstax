"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Calendar,
  Clock,
  User,
  Building2,
  Hash,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  CreditCard,
  Landmark,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendNoticeDialog } from "@/components/tenants/send-notice-dialog";

interface PaymentDetail {
  id: string;
  amount: number;
  surchargeAmount: number | null;
  landlordFee: number | null;
  type: string;
  status: string;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  achLast4: string | null;
  kadimaTransactionId: string | null;
  description: string | null;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  tenant: {
    userId: string;
    user: { id: string; name: string; email: string };
  };
  unit: {
    unitNumber: string;
    property: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  landlord: { name: string; email: string };
  gatewayDetails?: {
    // Card fields
    authCode?: string;
    avsResponse?: string;
    cvvResponse?: string;
    referenceNumber?: string;
    responseCode?: string;
    responseText?: string;
    cardholderName?: string;
    billingAddress?: { address1?: string; city?: string; state?: string; zip?: string };
    entryMode?: string;
    // ACH fields
    secCode?: string;
    effectiveDate?: string;
    traceNumber?: string;
    batchNumber?: string;
    accountType?: string;
    routingNumber?: string;
    accountNumber?: string;
  } | null;
}

interface TransactionDetailSheetProps {
  paymentId: string | null;
  onClose: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-36" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-48" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function TimelinessDisplay({ payment }: { payment: PaymentDetail }) {
  const dueDate = new Date(payment.dueDate);
  const now = new Date();

  if (payment.status === "COMPLETED" && payment.paidAt) {
    const paidDate = new Date(payment.paidAt);
    if (paidDate <= dueDate) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          On Time
        </span>
      );
    }
    const diffMs = paidDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {diffDays} {diffDays === 1 ? "day" : "days"} late
      </span>
    );
  }

  if (payment.status === "PENDING") {
    if (now > dueDate) {
      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-amber-500">
          <Clock className="h-4 w-4" />
          Overdue by {diffDays} {diffDays === 1 ? "day" : "days"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        Due {formatDate(payment.dueDate)}
      </span>
    );
  }

  return null;
}

export function TransactionDetailSheet({
  paymentId,
  onClose,
}: TransactionDetailSheetProps) {
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setPayment(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/payments/${paymentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load payment details");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setPayment(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const isOpen = paymentId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Transaction Details</SheetTitle>
        </SheetHeader>

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="flex items-center gap-2 p-6 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!loading && !error && payment && (
          <div className="space-y-6 px-4 pb-6">
            {/* Amount Section */}
            <div>
              <SectionLabel>Amount</SectionLabel>
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(
                  payment.amount + (payment.surchargeAmount || 0)
                )}
              </p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Base Amount</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
                {payment.surchargeAmount != null &&
                  payment.surchargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Card Surcharge</span>
                      <span>
                        {formatCurrency(payment.surchargeAmount)}
                      </span>
                    </div>
                  )}
                {payment.surchargeAmount != null &&
                  payment.surchargeAmount > 0 && (
                    <div className="flex justify-between font-medium text-foreground">
                      <span>Total</span>
                      <span>
                        {formatCurrency(
                          payment.amount +
                            (payment.surchargeAmount || 0)
                        )}
                      </span>
                    </div>
                  )}
                {payment.landlordFee != null &&
                  payment.landlordFee > 0 && (
                    <div className="flex justify-between">
                      <span>Platform Fee</span>
                      <span>{formatCurrency(payment.landlordFee)}</span>
                    </div>
                  )}
              </div>
            </div>

            <Separator />

            {/* Payment Method */}
            <div>
              <SectionLabel>Payment Method</SectionLabel>
              <PaymentMethodBadge
                method={payment.paymentMethod}
                cardBrand={payment.cardBrand}
                cardLast4={payment.cardLast4}
                achLast4={payment.achLast4}
              />
            </div>

            <Separator />

            {/* Status & Timeliness */}
            <div>
              <SectionLabel>Status & Timeliness</SectionLabel>
              <div className="flex flex-col gap-2">
                <StatusBadge status={payment.status} />
                <TimelinessDisplay payment={payment} />
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div>
              <SectionLabel>Timeline</SectionLabel>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created {formatDate(payment.createdAt)}</span>
                </div>
                {payment.paidAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Paid {formatDate(payment.paidAt)}</span>
                  </div>
                )}
                {payment.status === "FAILED" && (
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span>Failed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Gateway Details */}
            {payment.gatewayDetails && (
              <>
                <Separator />
                <div>
                  <SectionLabel>Gateway Details</SectionLabel>
                  {payment.paymentMethod === "card" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Card Transaction
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {payment.kadimaTransactionId && (
                          <>
                            <span className="text-muted-foreground">Transaction ID</span>
                            <span className="font-mono text-xs">{payment.kadimaTransactionId}</span>
                          </>
                        )}
                        {payment.gatewayDetails.referenceNumber && (
                          <>
                            <span className="text-muted-foreground">Reference Number</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.referenceNumber}</span>
                          </>
                        )}
                        {payment.gatewayDetails.authCode && (
                          <>
                            <span className="text-muted-foreground">Auth Code</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.authCode}</span>
                          </>
                        )}
                        {(payment.gatewayDetails.responseCode || payment.gatewayDetails.responseText) && (
                          <>
                            <span className="text-muted-foreground">Response</span>
                            <span className="text-xs">
                              {payment.gatewayDetails.responseCode && (
                                <span className="font-mono">{payment.gatewayDetails.responseCode}</span>
                              )}
                              {payment.gatewayDetails.responseCode && payment.gatewayDetails.responseText && " - "}
                              {payment.gatewayDetails.responseText}
                            </span>
                          </>
                        )}
                        {(payment.cardBrand || payment.cardLast4 || payment.gatewayDetails.cardholderName) && (
                          <>
                            <span className="text-muted-foreground">Card</span>
                            <span className="text-xs">
                              {payment.cardBrand && <span className="capitalize">{payment.cardBrand}</span>}
                              {payment.cardLast4 && <span> ****{payment.cardLast4}</span>}
                              {payment.gatewayDetails.cardholderName && (
                                <span className="block text-muted-foreground">{payment.gatewayDetails.cardholderName}</span>
                              )}
                            </span>
                          </>
                        )}
                        {payment.gatewayDetails.avsResponse && (
                          <>
                            <span className="text-muted-foreground">AVS Response</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.avsResponse}</span>
                          </>
                        )}
                        {payment.gatewayDetails.cvvResponse && (
                          <>
                            <span className="text-muted-foreground">CVV Response</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.cvvResponse}</span>
                          </>
                        )}
                        {payment.gatewayDetails.entryMode && (
                          <>
                            <span className="text-muted-foreground">Entry Mode</span>
                            <span className="text-xs">{payment.gatewayDetails.entryMode}</span>
                          </>
                        )}
                      </div>
                      {payment.gatewayDetails.billingAddress && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground block mb-1">Billing Address</span>
                          <span className="text-xs">
                            {payment.gatewayDetails.billingAddress.address1 && (
                              <span className="block">{payment.gatewayDetails.billingAddress.address1}</span>
                            )}
                            {(payment.gatewayDetails.billingAddress.city || payment.gatewayDetails.billingAddress.state || payment.gatewayDetails.billingAddress.zip) && (
                              <span className="block">
                                {[
                                  payment.gatewayDetails.billingAddress.city,
                                  payment.gatewayDetails.billingAddress.state,
                                  payment.gatewayDetails.billingAddress.zip,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {payment.paymentMethod === "ach" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        ACH Transaction
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {payment.kadimaTransactionId && (
                          <>
                            <span className="text-muted-foreground">Transaction ID</span>
                            <span className="font-mono text-xs">{payment.kadimaTransactionId}</span>
                          </>
                        )}
                        {payment.gatewayDetails.secCode && (
                          <>
                            <span className="text-muted-foreground">SEC Code</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.secCode}</span>
                          </>
                        )}
                        {(payment.gatewayDetails.accountType || payment.gatewayDetails.routingNumber || payment.gatewayDetails.accountNumber) && (
                          <>
                            <span className="text-muted-foreground">Account</span>
                            <span className="text-xs">
                              {payment.gatewayDetails.accountType && (
                                <span className="capitalize block">{payment.gatewayDetails.accountType}</span>
                              )}
                              {payment.gatewayDetails.routingNumber && (
                                <span className="block font-mono">RTN: {payment.gatewayDetails.routingNumber}</span>
                              )}
                              {payment.gatewayDetails.accountNumber && (
                                <span className="block font-mono">Acct: {payment.gatewayDetails.accountNumber}</span>
                              )}
                            </span>
                          </>
                        )}
                        {payment.gatewayDetails.effectiveDate && (
                          <>
                            <span className="text-muted-foreground">Effective Date</span>
                            <span className="text-xs">{payment.gatewayDetails.effectiveDate}</span>
                          </>
                        )}
                        {payment.gatewayDetails.traceNumber && (
                          <>
                            <span className="text-muted-foreground">Trace Number</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.traceNumber}</span>
                          </>
                        )}
                        {payment.gatewayDetails.batchNumber && (
                          <>
                            <span className="text-muted-foreground">Batch Number</span>
                            <span className="font-mono text-xs">{payment.gatewayDetails.batchNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Tenant Info */}
            <div>
              <SectionLabel>Tenant</SectionLabel>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {payment.tenant.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.tenant.user.email}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Property Info */}
            <div>
              <SectionLabel>Property</SectionLabel>
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {payment.unit.property.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.unit.property.address},{" "}
                    {payment.unit.property.city},{" "}
                    {payment.unit.property.state}{" "}
                    {payment.unit.property.zip}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Unit {payment.unit.unitNumber}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Transaction Details */}
            <div>
              <SectionLabel>Transaction Details</SectionLabel>
              <div className="flex items-start gap-2">
                <Hash className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-2">
                  <StatusBadge status={payment.type} />
                  {payment.kadimaTransactionId && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Transaction ID:</span>
                      <span className="font-mono">
                        {payment.kadimaTransactionId}
                      </span>
                    </div>
                  )}
                  {payment.description && (
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{payment.description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Download Receipt for COMPLETED payments */}
            {payment.status === "COMPLETED" && (
              <>
                <Separator />
                <div>
                  <SectionLabel>Receipt</SectionLabel>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(`/api/payments/${payment.id}/receipt`, "_blank")}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Download Receipt
                  </Button>
                </div>
              </>
            )}

            {/* Send Payment Reminder for FAILED payments */}
            {payment.status === "FAILED" && payment.tenant?.userId && (
              <>
                <Separator />
                <div>
                  <SectionLabel>Actions</SectionLabel>
                  <SendNoticeDialog
                    targetUserId={payment.tenant.userId}
                    targetName={payment.tenant.user.name}
                    trigger={
                      <Button variant="destructive" size="sm" className="w-full">
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Send Payment Reminder
                      </Button>
                    }
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    This payment of {formatCurrency(payment.amount)} for Unit{" "}
                    {payment.unit.unitNumber} is in arrears until paid.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
