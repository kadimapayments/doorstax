"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Check, PenSquare } from "lucide-react";

interface Recipient {
  id: string;
  userId: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  user: { name: string; email: string };
}

interface MessageItem {
  id: string;
  type: "DIRECT" | "ANNOUNCEMENT";
  subject: string;
  body: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  sender: { name: string; role: string };
  recipients: Recipient[];
  property: { name: string } | null;
}

export default function TenantMessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Messages"
          description="View messages and announcements from your property manager."
        />
        <Link href="/tenant/messages/new">
          <Button>
            <PenSquare className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </Link>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="No messages"
          description="You have no messages at this time."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const myReceipt = m.recipients[0];
            const isUnread = !myReceipt?.readAt;
            const isAcknowledged = !!myReceipt?.acknowledgedAt;

            return (
              <Link key={m.id} href={`/tenant/messages/${m.id}`}>
                <Card
                  className={`border-border hover:bg-muted/50 transition-colors cursor-pointer mb-3 ${
                    isUnread ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`${isUnread ? "font-bold" : "font-medium"}`}
                        >
                          {m.subject}
                        </span>
                        <Badge
                          variant={
                            m.type === "ANNOUNCEMENT" ? "default" : "outline"
                          }
                          className={
                            m.type === "ANNOUNCEMENT"
                              ? "bg-blue-500/15 text-blue-500 border-blue-500/20"
                              : ""
                          }
                        >
                          {m.type === "DIRECT" ? "Direct" : "Announcement"}
                        </Badge>
                        {(m.priority === "HIGH" || m.priority === "URGENT") && (
                          <Badge
                            variant="outline"
                            className={
                              m.priority === "URGENT"
                                ? "bg-destructive/15 text-destructive border-destructive/20"
                                : "bg-amber-500/15 text-amber-500 border-amber-500/20"
                            }
                          >
                            {m.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        From: {m.sender.name} &middot;{" "}
                        {formatDate(m.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAcknowledged && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                          <Check className="h-3 w-3" />
                          Acknowledged
                        </span>
                      )}
                      {isUnread && (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
