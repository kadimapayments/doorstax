"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Send, ImagePlus, Download, Calendar, DollarSign, Wrench } from "lucide-react";
import { CompletionProofDisplay } from "@/components/vendor/completion-proof-display";

interface Comment {
  id: string;
  content: string;
  images: string[];
  createdAt: string;
  author: { name: string; role: string };
}

interface Vendor {
  id: string;
  name: string;
  company: string | null;
  category: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  images: string[];
  createdAt: string;
  resolvedAt: string | null;
  tenant: { user: { name: string; email: string } };
  unit: { unitNumber: string; property: { name: string } };
  comments: Comment[];
  vendorId: string | null;
  vendor: { id: string; name: string; company: string | null; category: string } | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledDate: string | null;
  completedDate: string | null;
  completionNotes: string | null;
  completionImages: string[];
  completionSubmittedAt: string | null;
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Local state for cost inputs so they don't fight with server state while typing
  const [estimatedCostInput, setEstimatedCostInput] = useState("");
  const [actualCostInput, setActualCostInput] = useState("");

  async function loadTicket() {
    const res = await fetch(`/api/tickets/${params.id}`);
    if (res.ok) {
      const data: Ticket = await res.json();
      setTicket(data);
      setEstimatedCostInput(data.estimatedCost != null ? String(data.estimatedCost) : "");
      setActualCostInput(data.actualCost != null ? String(data.actualCost) : "");
    }
    setLoading(false);
  }

  async function loadVendors() {
    try {
      const res = await fetch("/api/vendors");
      if (res.ok) {
        setVendors(await res.json());
      }
    } catch {
      // silently fail — vendor list is non-critical
    }
  }

  useEffect(() => {
    loadTicket();
    loadVendors();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFieldUpdate = useCallback(
    async (field: string, value: string | number | null) => {
      setUpdating(true);
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        await loadTicket();
        toast.success(`${field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} updated`);
      } else {
        toast.error(`Failed to update ${field}`);
      }
      setUpdating(false);
    },
    [params.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const urls: string[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        urls.push(data.url);
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setCommentImages((prev) => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() && commentImages.length === 0) return;

    setPosting(true);
    const res = await fetch(`/api/tickets/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment, images: commentImages }),
    });

    if (res.ok) {
      setComment("");
      setCommentImages([]);
      await loadTicket();
    } else {
      toast.error("Failed to post comment");
    }
    setPosting(false);
  }

  async function handleStatusChange(status: string) {
    setUpdating(true);
    const res = await fetch(`/api/tickets/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      await loadTicket();
      toast.success(`Status updated to ${status}`);
    } else {
      toast.error("Failed to update status");
    }
    setUpdating(false);
  }

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading...</div>;
  }

  if (!ticket) {
    return <div className="py-20 text-center text-muted-foreground">Ticket not found.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.title}
        description={`${ticket.unit.property.name} — Unit ${ticket.unit.unitNumber}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="border-border">
            <CardContent className="p-6">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              {ticket.images.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ticket.images.map((img, i) => (
                    <div key={i} className="group relative">
                      <a href={img} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={img}
                          alt={`Attachment ${i + 1}`}
                          width={120}
                          height={120}
                          className="rounded border border-border object-cover"
                        />
                      </a>
                      <a
                        href={img}
                        download
                        className="absolute bottom-1 right-1 hidden group-hover:flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor completion proof */}
          {(ticket.completionNotes ||
            (ticket.completionImages && ticket.completionImages.length > 0)) && (
            <CompletionProofDisplay
              notes={ticket.completionNotes}
              images={ticket.completionImages || []}
              submittedAt={ticket.completionSubmittedAt}
              title={
                ticket.vendor
                  ? `Completion proof from ${ticket.vendor.name}`
                  : "Completion proof"
              }
            />
          )}

          {/* Comments */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                Comments ({ticket.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                ticket.comments.map((c) => (
                  <div key={c.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.author.role === "PM" ? "Manager" : "Tenant"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(c.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    {c.images?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.images.map((img, i) => (
                          <div key={i} className="group relative">
                            <a href={img} target="_blank" rel="noopener noreferrer">
                              <Image
                                src={img}
                                alt={`Attachment ${i + 1}`}
                                width={80}
                                height={80}
                                className="rounded border border-border object-cover"
                              />
                            </a>
                            <a
                              href={img}
                              download
                              className="absolute bottom-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Add comment form */}
              <form onSubmit={handleComment} className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label>Add Comment</Label>
                  <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment..."
                  />
                </div>

                {commentImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {commentImages.map((img, i) => (
                      <div key={i} className="relative">
                        <Image
                          src={img}
                          alt={`Upload ${i + 1}`}
                          width={60}
                          height={60}
                          className="rounded border border-border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setCommentImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                      <span>
                        <ImagePlus className="mr-1 h-3 w-3" />
                        {uploading ? "Uploading..." : "Attach Image"}
                      </span>
                    </Button>
                  </label>
                  <Button type="submit" size="sm" disabled={posting || (!comment.trim() && commentImages.length === 0)}>
                    <Send className="mr-1 h-3 w-3" />
                    {posting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Priority</p>
                <StatusBadge status={ticket.priority} />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm">{ticket.category}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="text-sm">{ticket.tenant.user.name}</p>
                <p className="text-xs text-muted-foreground">{ticket.tenant.user.email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(new Date(ticket.createdAt))}</p>
              </div>

              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="text-sm">{formatDate(new Date(ticket.resolvedAt))}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Assignment */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Vendor Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Assigned Vendor</Label>
                <Select
                  value={ticket.vendorId ?? "unassigned"}
                  onValueChange={(value) =>
                    handleFieldUpdate("vendorId", value === "unassigned" ? null : value)
                  }
                  disabled={updating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.company ? `(${v.company})` : ""} — {v.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ticket.vendor && (
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-sm font-medium">{ticket.vendor.name}</p>
                  {ticket.vendor.company && (
                    <p className="text-xs text-muted-foreground">{ticket.vendor.company}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{ticket.vendor.category}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Tracking */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Cost Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Estimated Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="mt-1"
                  value={estimatedCostInput}
                  onChange={(e) => setEstimatedCostInput(e.target.value)}
                  onBlur={() => {
                    const parsed = estimatedCostInput ? parseFloat(estimatedCostInput) : null;
                    if (parsed !== ticket.estimatedCost) {
                      handleFieldUpdate("estimatedCost", parsed);
                    }
                  }}
                  disabled={updating}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Actual Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="mt-1"
                  value={actualCostInput}
                  onChange={(e) => setActualCostInput(e.target.value)}
                  onBlur={() => {
                    const parsed = actualCostInput ? parseFloat(actualCostInput) : null;
                    if (parsed !== ticket.actualCost) {
                      handleFieldUpdate("actualCost", parsed);
                    }
                  }}
                  disabled={updating}
                />
              </div>
              {(ticket.estimatedCost != null || ticket.actualCost != null) && (
                <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                  {ticket.estimatedCost != null && (
                    <p>
                      Estimated: <span className="font-medium">{formatCurrency(ticket.estimatedCost)}</span>
                    </p>
                  )}
                  {ticket.actualCost != null && (
                    <p>
                      Actual: <span className="font-medium">{formatCurrency(ticket.actualCost)}</span>
                    </p>
                  )}
                  {ticket.estimatedCost != null && ticket.actualCost != null && (
                    <p
                      className={
                        ticket.actualCost > ticket.estimatedCost
                          ? "text-destructive font-medium"
                          : "text-green-600 font-medium"
                      }
                    >
                      {ticket.actualCost > ticket.estimatedCost ? "Over" : "Under"} budget by{" "}
                      {formatCurrency(Math.abs(ticket.actualCost - ticket.estimatedCost))}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Scheduled Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={ticket.scheduledDate ?? ""}
                  onChange={(e) =>
                    handleFieldUpdate("scheduledDate", e.target.value || null)
                  }
                  disabled={updating}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Completed Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={ticket.completedDate ?? ""}
                  onChange={(e) =>
                    handleFieldUpdate("completedDate", e.target.value || null)
                  }
                  disabled={updating}
                />
              </div>
              {(ticket.scheduledDate || ticket.completedDate) && (
                <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                  {ticket.scheduledDate && (
                    <p>
                      Scheduled: <span className="font-medium">{formatDate(new Date(ticket.scheduledDate))}</span>
                    </p>
                  )}
                  {ticket.completedDate && (
                    <p>
                      Completed: <span className="font-medium">{formatDate(new Date(ticket.completedDate))}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
