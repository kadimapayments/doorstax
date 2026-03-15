"use client";

import React from "react";
import Image from "next/image";
import { CreditCard, Landmark } from "lucide-react";

interface PaymentMethodBadgeProps {
  method: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  achLast4?: string | null;
}

const brandImages: Record<string, { src: string; alt: string; width: number; height: number }> = {
  visa: { src: "/trust/visa.webp", alt: "Visa", width: 40, height: 14 },
  mastercard: { src: "/trust/mastercard.webp", alt: "Mastercard", width: 28, height: 18 },
  amex: { src: "/trust/amex.webp", alt: "Amex", width: 32, height: 14 },
  discover: { src: "/trust/discover.webp", alt: "Discover", width: 40, height: 14 },
  jcb: { src: "/trust/jcb.webp", alt: "JCB", width: 28, height: 18 },
  unionpay: { src: "/trust/unionpay.webp", alt: "UnionPay", width: 32, height: 18 },
};

export function PaymentMethodBadge({
  method,
  cardBrand,
  cardLast4,
  achLast4,
}: PaymentMethodBadgeProps) {
  if (!method) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (method === "card") {
    const brand = cardBrand ? brandImages[cardBrand.toLowerCase()] : null;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        {brand ? (
          <Image src={brand.src} alt={brand.alt} width={brand.width} height={brand.height} className="object-contain" />
        ) : (
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {cardLast4 ? (
          <span className="text-muted-foreground font-mono text-xs">
            •••• {cardLast4}
          </span>
        ) : !brand && !cardBrand ? (
          <span>Card</span>
        ) : cardBrand && !brand ? (
          <span>{cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)}</span>
        ) : null}
      </span>
    );
  }

  if (method === "ach") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <Landmark className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        {achLast4 ? (
          <span className="text-muted-foreground font-mono text-xs">
            •••• {achLast4}
          </span>
        ) : (
          <span>ACH</span>
        )}
      </span>
    );
  }

  return (
    <span className="text-sm">
      {method.charAt(0).toUpperCase() + method.slice(1)}
    </span>
  );
}
