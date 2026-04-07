import fs from "fs";
import path from "path";
import Link from "next/link";

export const metadata = {
  title: "Merchant Agreement V1.8 — DoorStax Payment Network",
  description: "Terms and Conditions for the DoorStax Payment Network Merchant Account Agreement.",
};

export default function MerchantAgreementPage() {
  // Read the markdown file at build time
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "public", "legal", "merchant-agreement-v1.8.md");
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    content = "Agreement content not available. Please contact support.";
  }

  // Split into sections by ## headers
  const sections = content
    .split(/(?=^## )/m)
    .filter((s) => s.trim() && s.startsWith("## "));

  // Extract preamble (before first ##)
  const preambleEnd = content.indexOf("## ");
  const preamble = preambleEnd > 0 ? content.substring(0, preambleEnd).trim() : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">DoorStax Payment Network</h1>
            <p className="text-xs text-muted-foreground">Merchant Account Agreement V1.8</p>
          </div>
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to DoorStax
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Merchant Account Agreement</h1>
          <p className="text-sm text-muted-foreground">Version 1.8 — DoorStax Payment Network | Kadima Payments</p>
          <div className="h-1 w-20 bg-primary mt-4 rounded-full" />
        </div>

        {/* Preamble */}
        {preamble && (
          <div className="text-sm text-muted-foreground leading-relaxed mb-8 whitespace-pre-wrap">
            {preamble
              .replace(/^# .*\n/m, "")
              .replace(/^\*\*.*\*\*\n/m, "")
              .replace(/^---$/m, "")
              .trim()}
          </div>
        )}

        {/* Table of Contents */}
        <div className="rounded-lg border bg-card p-4 mb-10">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Table of Contents</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {sections.map((section, i) => {
              const title = section.split("\n")[0].replace("## ", "").trim();
              return (
                <a
                  key={i}
                  href={`#section-${i}`}
                  className="text-xs text-primary hover:underline py-0.5"
                >
                  {title}
                </a>
              );
            })}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, i) => {
            const lines = section.split("\n");
            const title = lines[0].replace("## ", "").trim();
            const body = lines.slice(1).join("\n").trim();
            return (
              <div key={i} id={`section-${i}`} className="scroll-mt-20">
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{body}</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t mt-12 pt-6 text-center text-xs text-muted-foreground">
          <p>DoorStax Payment Network — Powered by Kadima Payments</p>
          <p className="mt-1">
            Processing services provided by Maverick BankCard, Inc. through Axiom Bank N.A., FFB Bank, Avidia Bank, WestAmerica Bank, or North American Banking Company.
          </p>
        </div>
      </main>
    </div>
  );
}
