import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "DoorStax Developer Portal",
  description:
    "API documentation, guides, and reference for building on the DoorStax property management platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="font-[family-name:var(--font-manrope)] antialiased">
        <Sidebar />
        <main className="lg:pl-[280px]">
          <div className="max-w-6xl mx-auto px-6 py-10 lg:px-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
