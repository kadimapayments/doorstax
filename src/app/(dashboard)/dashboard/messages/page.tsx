"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SortableHeader, toggleSort, sortCompare, type SortDir } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { Plus, Megaphone, MessageSquare } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";

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
  propertyId: string | null;
  sender: { name: string; role: string };
  recipients: Recipient[];
  property: { name: string } | null;
}

const typeFilters = ["All", "DIRECT", "ANNOUNCEMENT"] as const;

export default function LandlordMessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [filter, setFilter] = useState<(typeof typeFilters)[number]>("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    const s = toggleSort(key, sortCol, sortDir);
    setSortCol(s.sort);
    setSortDir(s.dir);
  }

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []));
  }, []);

  const filtered =
    filter === "All"
      ? messages
      : messages.filter((m) => m.type === filter);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: unknown, bVal: unknown;
      switch (sortCol) {
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "recipientName":
          aVal = a.type === "DIRECT" ? (a.recipients[0]?.user.name || "") : (a.property?.name || "All Tenants");
          bVal = b.type === "DIRECT" ? (b.recipients[0]?.user.name || "") : (b.property?.name || "All Tenants");
          break;
        default:
          return 0;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filtered, sortCol, sortDir]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Send direct messages and announcements to tenants."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/messages/new">
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                New Message
              </Button>
            </Link>
            <Link href="/dashboard/messages/new?type=ANNOUNCEMENT">
              <Button>
                <Megaphone className="mr-2 h-4 w-4" />
                New Announcement
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1">
        {typeFilters.map((t) => (
          <Button
            key={t}
            variant={filter === t ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter(t); setPage(1); }}
          >
            {t === "All" ? "All" : t === "DIRECT" ? "Direct" : "Announcements"}
          </Button>
        ))}
      </div>

      {/* Sort controls */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1">
          <span className="text-xs text-muted-foreground mr-2">Sort by:</span>
          <table className="text-sm"><thead><tr>
            <SortableHeader label="Date" sortKey="createdAt" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
            <SortableHeader label="Recipient" sortKey="recipientName" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
          </tr></thead></table>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="No messages"
          description="Send a direct message or announcement to your tenants."
          action={
            <Link href="/dashboard/messages/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Message
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => {
            const readCount = m.recipients.filter((r) => r.readAt).length;
            const ackCount = m.recipients.filter((r) => r.acknowledgedAt).length;
            const totalRecipients = m.recipients.length;

            return (
              <Link key={m.id} href={`/dashboard/messages/${m.id}`}>
                <Card className="border-border hover:bg-muted/50 transition-colors cursor-pointer mb-3">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.subject}</span>
                        <Badge
                          variant={m.type === "ANNOUNCEMENT" ? "default" : "outline"}
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
                        {m.type === "DIRECT" ? (
                          <>To: {m.recipients[0]?.user.name || "Unknown"}</>
                        ) : (
                          <>
                            To:{" "}
                            {m.property
                              ? `${m.property.name} (${totalRecipients} tenants)`
                              : `All Tenants (${totalRecipients})`}
                          </>
                        )}
                        {" \u00B7 "}
                        {formatDate(m.createdAt)}
                      </p>
                      {m.type === "ANNOUNCEMENT" && totalRecipients > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {readCount}/{totalRecipients} read &middot;{" "}
                          {ackCount}/{totalRecipients} acknowledged
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
            <PaginationControls page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} />
          )}
        </div>
      )}
    </div>
  );
}
