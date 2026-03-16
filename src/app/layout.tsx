import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import { resolveWhiteLabelPartner, getDefaultBranding } from "@/lib/white-label";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doorstax.com"),
  title: {
    default: "DoorStax — Rent Payment Infrastructure for Property Managers",
    template: "%s | DoorStax",
  },
  description:
    "Turn rent collection into a revenue stream. DoorStax automates rent payments, centralizes reconciliation, and generates passive income for property managers with 100+ units.",
  openGraph: {
    type: "website",
    url: "https://doorstax.com",
    title: "DoorStax — Rent Payment Infrastructure for Property Managers",
    description:
      "Turn rent collection into a revenue stream. DoorStax automates rent payments, centralizes reconciliation, and generates passive income for property managers with 100+ units.",
    siteName: "DoorStax",
  },
  twitter: {
    card: "summary_large_image",
    title: "DoorStax — Rent Payment Infrastructure for Property Managers",
    description:
      "Turn rent collection into a revenue stream. DoorStax automates rent payments, centralizes reconciliation, and generates passive income for property managers with 100+ units.",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve white-label partner from hostname
  const headersList = await headers();
  const hostname = headersList.get("host") || "";
  const partner = await resolveWhiteLabelPartner(hostname);
  const branding = partner
    ? {
        name: partner.name,
        logoUrl: partner.logoUrl,
        primaryColor: partner.primaryColor,
        accentColor: partner.accentColor,
        isWhiteLabel: true,
      }
    : getDefaultBranding();

  // Build CSS variable overrides for white-label partners
  const styleOverrides = partner
    ? {
        "--wl-primary": partner.primaryColor,
        "--wl-accent": partner.accentColor,
      } as React.CSSProperties
    : undefined;

  return (
    <html lang="en" suppressHydrationWarning style={styleOverrides}>
      <body className={`${manrope.variable} font-sans antialiased`}>
        <Providers whiteLabelBranding={branding}>{children}</Providers>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SMD3TWCZN3"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SMD3TWCZN3');
          `}
        </Script>
      </body>
    </html>
  );
}
