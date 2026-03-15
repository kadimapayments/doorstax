"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Send, Check } from "lucide-react";

interface Recipient {
  id: string;
  userId: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  user: { name: string; email: string };
}

interface ThreadMessage {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  sender: { name: string; role: string };
  recipients: Recipient[];
}

interface MessageDetail {
  id: string;
  type: "DIRECT" | "ANNOUNCEMENT";
  subject: string;
  body: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  imageUrl?: string;
  createdAt: string;
  senderId: string;
  sender: { name: string; role: string };
  recipients: Recipient[];
  property: { name: string } | null;
  thread: ThreadMessage[];
}

export default function TenantMessageDetailPage() {
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const markedReadRef = useRef(false);

  async function loadMessage() {
    const res = await fetch(`/api/messages/${params.id}`);
    if (res.ok) {
      setMessage(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMessage();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-mark as read when loaded
  useEffect(() => {
    if (message && !markedReadRef.current) {
      markedReadRef.current = true;
      fetch(`/api/messages/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      });
    }
  }, [message, params.id]);

  async function handleAcknowledge() {
    setAcknowledging(true);
    try {
      const res = await fetch(`/api/messages/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });

      if (res.ok) {
        toast.success("Message acknowledged");
        await loadMessage();
      } else {
        toast.error("Failed to acknowledge");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setAcknowledging(false);
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !message) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DIRECT",
          subject: `Re: ${message.subject}`,
          body: replyBody,
          threadId: message.id,
        }),
      });

      if (res.ok) {
        setReplyBody("");
        await loadMessage();
        toast.success("Reply sent");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send reply");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (!message) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Message not found.
      </div>
    );
  }

  // Find this tenant's receipt
  const myReceipt = message.recipients[0];
  const isAcknowledged = !!myReceipt?.acknowledgedAt;

  return (
    <div className="space-y-6">
      <Link
        href="/tenant/messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      <PageHeader
        title={message.subject}
        description={`From ${message.sender.name} \u00B7 ${formatDate(message.createdAt)}`}
      />

      {/* Badges */}
      <div className="flex items-center gap-2">
        {(message.priority === "HIGH" || message.priority === "URGENT") && (
          <Badge
            variant="outline"
            className={
              message.priority === "URGENT"
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : "bg-amber-500/15 text-amber-500 border-amber-500/20"
            }
          >
            {message.priority}
          </Badge>
        )}
        <Badge
          variant={message.type === "ANNOUNCEMENT" ? "default" : "outline"}
          className={
            message.type === "ANNOUNCEMENT"
              ? "bg-blue-500/15 text-blue-500 border-blue-500/20"
              : ""
          }
        >
          {message.type === "DIRECT" ? "Direct" : "Announcement"}
        </Badge>
      </div>

      {/* Message body */}
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
          {/* Message image */}
          {message.imageUrl && (
            <div className="mt-4">
              <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                <Image
                  src={message.imageUrl}
                  alt="Attachment"
                  width={400}
                  height={300}
                  className="rounded border border-border object-cover max-w-full"
                />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acknowledge button / status */}
      {message.type === "ANNOUNCEMENT" && (
        <div>
          {isAcknowledged ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-500">
              <Check className="h-4 w-4" />
              Acknowledged on {formatDate(myReceipt.acknowledgedAt!)}
            </div>
          ) : (
            <Button onClick={handleAcknowledge} disabled={acknowledging}>
              <Check className="mr-2 h-4 w-4" />
              {acknowledging ? "Acknowledging..." : "Acknowledge"}
            </Button>
          )}
        </div>
      )}

      {/* Thread / Replies */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">
            Replies ({message.thread.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message.thread.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
          ) : (
            message.thread.map((t) => (
              <div
                key={t.id}
                className="border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {t.sender.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.sender.role === "PM" ? "Manager" : "Tenant"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{t.body}</p>
              </div>
            ))
          )}

          {/* Reply form */}
          <form
            onSubmit={handleReply}
            className="space-y-3 pt-2 border-t border-border"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Reply</label>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={sending || !replyBody.trim()}
            >
              <Send className="mr-1 h-3 w-3" />
              {sending ? "Sending..." : "Send Reply"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
