import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CompletionProofDisplayProps {
  notes: string | null;
  images: string[];
  submittedAt: string | Date | null;
  /** Optional label — "Completion proof" on PM side, "Your submitted proof"
   *  on vendor side. */
  title?: string;
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Read-only view of a vendor's submitted completion proof. Shared
 * between the vendor's own ticket detail (so they can see what they
 * sent) and the PM's ticket detail (so they see the vendor's work).
 */
export function CompletionProofDisplay({
  notes,
  images,
  submittedAt,
  title = "Completion proof",
}: CompletionProofDisplayProps) {
  if (!notes && images.length === 0) return null;

  return (
    <Card className="border-border border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          {submittedAt && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Submitted {fmt(submittedAt)}
            </span>
          )}
        </div>

        {notes && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              What was done
            </div>
            <p className="text-sm whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {images.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Photos ({images.length})
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border hover:border-primary"
                >
                  {url.toLowerCase().endsWith(".pdf") ? (
                    <div className="h-24 flex items-center justify-center bg-muted text-xs text-muted-foreground">
                      PDF {i + 1}
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Proof ${i + 1}`}
                      className="w-full h-24 object-cover"
                    />
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
