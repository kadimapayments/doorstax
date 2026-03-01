import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doorstax.com"),
  title: {
    default: "DoorStax — Rent Collection & Property Operations",
    template: "%s | DoorStax",
  },
  description:
    "Landlord-first rent collection platform. Collect rent, manage properties, onboard tenants, and list availability — all powered by native payment infrastructure.",
  openGraph: {
    type: "website",
    url: "https://doorstax.com",
    title: "DoorStax — Rent Collection & Property Operations",
    description:
      "Landlord-first rent collection platform. Collect rent, manage properties, onboard tenants, and list availability.",
    siteName: "DoorStax",
  },
  twitter: {
    card: "summary_large_image",
    title: "DoorStax — Rent Collection & Property Operations",
    description:
      "Landlord-first rent collection platform. Collect rent, manage properties, onboard tenants, and list availability.",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
