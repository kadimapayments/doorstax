"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  PlayCircle,
  Loader2,
  User as UserIcon,
  Calendar,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VendorTicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusChanging, setStatusChanging] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/tickets/" + id);
      if (res.ok) {
        setTicket(await res.json());
      } else {
        toast.error("Could not load ticket");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function transitionStatus(newStatus: "IN_PROGRESS" | "RESOLVED") {
    setStatusChanging(true);
    try {
      const res = await fetch("/api/tickets/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(
          newStatus === "IN_PROGRESS"
            ? "Marked as In Progress"
            : "Marked as Resolved — the PM has been notified"
        );
        refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Status change failed");
      }
    } finally {
      setStatusChanging(false);
    }
  }

  async function handlePostComment() {
    if (!comment.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch("/api/tickets/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      });
      if (res.ok) {
        setComment("");
        refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to post comment");
      }
    } finally {
      setCommentSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">
          Ticket not found or you don&apos;t have access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4 page-enter">
      <button
        onClick={() => router.push("/vendor/tickets")}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </button>

      {/* Header */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold">{ticket.title}</h1>
                <Badge
                  variant="outline"
                  className={STATUS_CLASS[ticket.status] || STATUS_CLASS.OPEN}
                >
                  {ticket.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {ticket.priority} priority · {ticket.category.replace("_", " ")}
              </p>
            </div>
            {ticket.status === "OPEN" && (
              <button
                onClick={() => transitionStatus("IN_PROGRESS")}
                disabled={statusChanging}
                className="btn-press rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {statusChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Start Work
              </button>
            )}
            {ticket.status === "IN_PROGRESS" && (
              <button
                onClick={() => transitionStatus("RESOLVED")}
                disabled={statusChanging}
                className="btn-press rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {statusChanging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark Resolved
              </button>
            )}
          </div>

          <div className="pt-3 border-t space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Property Manager</p>
                <p>
                  {ticket.landlord?.companyName ||
                    ticket.landlord?.name ||
                    "PM"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p>
                  {ticket.unit?.property?.name} — Unit {ticket.unit?.unitNumber}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Opened</p>
                <p>{fmtDateTime(ticket.createdAt)}</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {ticket.images?.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Photos</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {ticket.images.map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Ticket photo ${i + 1}`}
                      className="w-full h-24 object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h2 className="text-sm font-semibold">
            Conversation ({ticket.comments?.length || 0})
          </h2>
          {(!ticket.comments || ticket.comments.length === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No messages yet. Post a comment below to update the PM.
            </p>
          ) : (
            <div className="space-y-3">
              {ticket.comments.map((c: any) => (
                <div
                  key={c.id}
                  className={
                    "rounded-lg p-3 text-sm " +
                    (c.author?.role === "VENDOR"
                      ? "bg-primary/5 border border-primary/10"
                      : "bg-muted/30 border border-border")
                  }
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium">
                      {c.author?.name || "User"}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {c.author?.role || ""}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtDateTime(c.createdAt)}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap">{c.content}</p>
                  {c.images?.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                      {c.images.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded overflow-hidden border hover:border-primary"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-20 object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Post comment */}
          <div className="pt-3 border-t space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Update the PM on what you found, what you did, or ask a question..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end">
              <button
                onClick={handlePostComment}
                disabled={commentSaving || !comment.trim()}
                className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {commentSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Post
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
