"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Send, Check, Minus } from "lucide-react";

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

export default function LandlordMessageDetailPage() {
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

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

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !message) return;

    setSending(true);

    // For a reply, determine the recipient
    // If landlord sent the original, reply goes to the first recipient
    // If it's a reply from tenant, reply goes back to that sender
    const recipientId =
      message.type === "DIRECT"
        ? message.recipients[0]?.userId
        : undefined;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DIRECT",
          subject: `Re: ${message.subject}`,
          body: replyBody,
          threadId: message.id,
          recipientId,
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

  const readCount = message.recipients.filter((r) => r.readAt).length;
  const ackCount = message.recipients.filter((r) => r.acknowledgedAt).length;
  const totalRecipients = message.recipients.length;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      <PageHeader
        title={message.subject}
        description={formatDate(message.createdAt)}
      />

      {/* Badges */}
      <div className="flex items-center gap-2">
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
      </div>

      {/* Sender / recipient info */}
      <div className="text-sm text-muted-foreground">
        <p>
          From: <span className="text-foreground">{message.sender.name}</span>
        </p>
        {message.type === "DIRECT" ? (
          <p>
            To:{" "}
            <span className="text-foreground">
              {message.recipients[0]?.user.name || "Unknown"}
            </span>{" "}
            ({message.recipients[0]?.user.email})
          </p>
        ) : (
          <p>
            To:{" "}
            <span className="text-foreground">
              {message.property
                ? `${message.property.name} (${totalRecipients} tenants)`
                : `All Tenants (${totalRecipients})`}
            </span>
          </p>
        )}
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

      {/* Acknowledgment table for announcements */}
      {message.type === "ANNOUNCEMENT" && totalRecipients > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">
              Acknowledgment Status
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {readCount}/{totalRecipients} read (
              {Math.round((readCount / totalRecipients) * 100)}%) &middot;{" "}
              {ackCount}/{totalRecipients} acknowledged (
              {Math.round((ackCount / totalRecipients) * 100)}%)
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium">Tenant</th>
                    <th className="py-2 text-left font-medium">Read</th>
                    <th className="py-2 text-left font-medium">
                      Acknowledged
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {message.recipients.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2">
                        <p className="font-medium">{r.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.user.email}
                        </p>
                      </td>
                      <td className="py-2">
                        {r.readAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <Check className="h-3 w-3" />
                            {formatDate(r.readAt)}
                          </span>
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2">
                        {r.acknowledgedAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <Check className="h-3 w-3" />
                            {formatDate(r.acknowledgedAt)}
                          </span>
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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

          {/* Reply form (only for DIRECT messages) */}
          {message.type === "DIRECT" && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
