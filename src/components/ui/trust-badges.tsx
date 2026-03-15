import Image from "next/image";
import { cn } from "@/lib/utils";

/* ── Card brand data ─────────────────────────────────── */

const CARD_BRANDS = [
  { src: "/trust/visa.webp", alt: "Visa" },
  { src: "/trust/mastercard.webp", alt: "Mastercard" },
  { src: "/trust/amex.webp", alt: "American Express" },
  { src: "/trust/discover.webp", alt: "Discover" },
] as const;

/* ── Shared logo pill ────────────────────────────────── */

function BrandPill({
  src,
  alt,
  size = "md",
}: {
  src: string;
  alt: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? 28 : 36;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-white/90 dark:bg-white/10 shadow-sm transition-opacity hover:opacity-100",
        size === "sm" ? "p-1 opacity-70" : "p-1.5 opacity-90",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={dim}
        height={dim}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: dim, maxWidth: dim }}
        loading="lazy"
      />
    </div>
  );
}

/* ── Public components ─────────────────────────────────── */

interface TrustBadgesProps {
  variant?: "compact" | "full" | "footer";
  showPci?: boolean;
  className?: string;
}

export function TrustBadges({
  variant = "compact",
  showPci = true,
  className,
}: TrustBadgesProps) {
  /* ─ Footer variant ─ */
  if (variant === "footer") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2",
          className,
        )}
      >
        {CARD_BRANDS.map((b) => (
          <BrandPill key={b.alt} src={b.src} alt={b.alt} size="sm" />
        ))}

        <div className="mx-1.5 h-5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/trust/pci-dss.webp"
            alt="PCI DSS Compliant"
            width={22}
            height={22}
            className="opacity-70"
            loading="lazy"
          />
          <span className="text-[10px] text-text-muted leading-tight">
            PCI DSS
          </span>
        </div>

        <div className="mx-1.5 h-5 w-px bg-border" />

        <span className="text-[10px] text-text-muted">
          Secured by{" "}
          <a
            href="https://kadimapayments.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-text-secondary hover:text-accent-lavender transition-colors"
          >
            Kadima Payments
          </a>
        </span>
      </div>
    );
  }

  /* ─ Full variant ─ */
  if (variant === "full") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-3",
          className,
        )}
      >
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">
          We accept
        </span>

        {CARD_BRANDS.map((b) => (
          <BrandPill key={b.alt} src={b.src} alt={b.alt} size="md" />
        ))}

        <BrandPill src="/trust/ach.webp" alt="ACH Bank Transfer" size="md" />

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/trust/pci-dss.webp"
            alt="PCI DSS Compliant"
            width={28}
            height={28}
            loading="lazy"
          />
          <span className="text-[10px] text-muted-foreground leading-tight">
            PCI DSS
            <br />
            Compliant
          </span>
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <svg
            className="h-4 w-4 text-green-600 dark:text-green-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] text-muted-foreground leading-tight">
            256-bit
            <br />
            SSL
          </span>
        </div>
      </div>
    );
  }

  /* ─ Compact variant (default) ─ */
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {CARD_BRANDS.map((b) => (
        <BrandPill key={b.alt} src={b.src} alt={b.alt} size="md" />
      ))}

      {showPci && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/trust/pci-dss.webp"
              alt="PCI DSS Compliant"
              width={24}
              height={24}
              loading="lazy"
            />
            <span className="text-[10px] text-muted-foreground leading-tight">
              PCI DSS
              <br />
              Compliant
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function PciBadge({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/trust/pci-dss.webp"
        alt="PCI DSS Compliant"
        width={24}
        height={24}
        loading="lazy"
      />
      <span className="text-[10px] text-muted-foreground leading-tight font-medium">
        PCI DSS
        <br />
        Compliant
      </span>
    </div>
  );
}
