import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  MessageSquare,
  User,
  Building2,
  Calendar,
  Tag,
} from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await db.serviceTicket.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: ticket ? `${ticket.title} — Admin` : "Ticket — Admin" };
}

function getStatusColor(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-500/15 text-blue-500 border-blue-500/20";
    case "IN_PROGRESS":
      return "bg-amber-500/15 text-amber-500 border-amber-500/20";
    case "RESOLVED":
      return "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";
    case "CLOSED":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "URGENT":
      return "bg-red-500/15 text-red-500 border-red-500/20";
    case "HIGH":
      return "bg-orange-500/15 text-orange-500 border-orange-500/20";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-500 border-amber-500/20";
    case "LOW":
      return "bg-blue-500/15 text-blue-500 border-blue-500/20";
    default:
      return "";
  }
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPermission("admin:tickets");
  const { id } = await params;

  const ticket = await db.serviceTicket.findUnique({
    where: { id },
    include: {
      tenant: { include: { user: { select: { name: true, email: true } } } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true, id: true } },
        },
      },
      landlord: { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Link>
        <PageHeader title={ticket.title} />
      </div>

      {/* Ticket Info */}
      <div className="rounded-lg border border-border p-6 card-glow">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <Badge variant="outline" className={getStatusColor(ticket.status)}>
              {ticket.status.replace("_", " ")}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Priority</p>
            <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
              {ticket.priority}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Category</p>
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <span className="font-medium">{ticket.category.replace("_", " ")}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Created</p>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="font-medium">{formatDate(ticket.createdAt)}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Submitter</p>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="font-medium">{ticket.tenant.user.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{ticket.tenant.user.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Landlord</p>
            <Link
              href={`/admin/landlords/${ticket.landlord.id}`}
              className="font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Building2 className="h-3 w-3" />
              {ticket.landlord.name}
            </Link>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Property / Unit</p>
            <Link
              href={`/admin/properties/${ticket.unit.property.id}`}
              className="font-medium text-primary hover:underline"
            >
              {ticket.unit.property.name}
            </Link>
            <span className="text-muted-foreground"> — Unit {ticket.unit.unitNumber}</span>
          </div>
          {ticket.resolvedAt && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Resolved</p>
              <span className="font-medium">{formatDate(ticket.resolvedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-border p-6 card-glow space-y-3">
        <h2 className="text-lg font-semibold">Description</h2>
        <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
        {ticket.images.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {ticket.images.map((img, i) => (
              <a
                key={i}
                href={img}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-border p-1 hover:border-primary transition-colors"
              >
                <img
                  src={img}
                  alt={`Attachment ${i + 1}`}
                  className="h-20 w-20 object-cover rounded"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Comments / Conversation */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversation ({ticket.comments.length})
        </h2>
        {ticket.comments.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
            No comments yet.
          </div>
        ) : (
          <div className="space-y-4">
            {ticket.comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border p-4 card-glow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {comment.author.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{comment.author.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {comment.author.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                {comment.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comment.images.map((img, i) => (
                      <a
                        key={i}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-border p-1 hover:border-primary transition-colors"
                      >
                        <img
                          src={img}
                          alt={`Comment attachment ${i + 1}`}
                          className="h-16 w-16 object-cover rounded"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
