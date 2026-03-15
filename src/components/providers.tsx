"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WhiteLabelProvider } from "@/lib/white-label-context";

interface ProvidersProps {
  children: React.ReactNode;
  whiteLabelBranding?: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    isWhiteLabel: boolean;
  };
}

export function Providers({ children, whiteLabelBranding }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <SessionProvider>
        <WhiteLabelProvider value={whiteLabelBranding}>
          {children}
          <Toaster />
        </WhiteLabelProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
