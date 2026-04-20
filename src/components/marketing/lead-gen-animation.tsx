"use client";

/**
 * Hero animation for the public DoorStax marketing page (coming-soon).
 *
 * Adapted from the 30-second lead-gen ad designed in Claude Design
 * (see bundle `doorstax-remix` from the "Lead Gen Ad" chat). The full
 * ad has five scenes across 30 seconds — too long for a web hero. This
 * component compresses Scene 1 ("rent just hit") + Scene 2 ("live
 * payment stacking with a climbing total") into a single ~10-second
 * loop, keeping the brand rhythm and typography intact.
 *
 * Design fidelity: DM Sans weight 300 for large numbers, JetBrains
 * Mono (with system fallback) for labels, tabular-nums for every
 * financial figure, gradient text on the counter, green dots on each
 * row, subtle purple glow behind everything. Dark navy background
 * exactly matches the ad's `#0C0D1F`.
 *
 * Runs entirely on requestAnimationFrame — no Babel, no custom Stage
 * framework, no heavy deps. Respects prefers-reduced-motion by
 * snapping to the final frame and not animating.
 */

import { useEffect, useRef, useState } from "react";

type Payment = {
  name: string;
  unit: string;
  amount: number;
  method: "ACH" | "CARD";
  appearAt: number;
};

const PAYMENTS: Payment[] = [
  { name: "Maria Chen", unit: "4B", amount: 1500, method: "ACH", appearAt: 0.4 },
  { name: "Devon Walker", unit: "12A", amount: 2150, method: "CARD", appearAt: 1.2 },
  { name: "Priya Shah", unit: "7C", amount: 1875, method: "ACH", appearAt: 2.0 },
  { name: "James O\u2019Neal", unit: "2D", amount: 1640, method: "ACH", appearAt: 2.8 },
  { name: "Lin Tanaka", unit: "9F", amount: 3200, method: "CARD", appearAt: 3.6 },
  { name: "Andre Jackson", unit: "15B", amount: 2450, method: "ACH", appearAt: 4.4 },
];

const TOTAL_END = PAYMENTS.reduce((s, p) => s + p.amount, 0); // 12,815
const LOOP = 10.0; // seconds, full cycle including hold + fade
const FEED_DONE = 5.4; // after last payment + catch-up
const FADE_START = 8.6;
const FADE_END = 9.4; // fade out window before reset

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));

const MONO_FAMILY =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS_FAMILY = "'DM Sans', system-ui, -apple-system, sans-serif";

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function usePlayhead(reducedMotion: boolean) {
  const [t, setT] = useState(reducedMotion ? FEED_DONE : 0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const tick = (now: number) => {
      if (start.current == null) start.current = now;
      const elapsed = (now - start.current) / 1000;
      // Loop: after FADE_END we restart cleanly.
      setT(elapsed % LOOP);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      start.current = null;
    };
  }, [reducedMotion]);

  return t;
}

export function LeadGenAnimation() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const t = usePlayhead(reducedMotion);

  // Fade the whole card in/out at loop boundaries for a clean restart.
  const cycleFade =
    t < 0.4
      ? t / 0.4 // fade in from reset
      : t > FADE_START
        ? clamp(1 - (t - FADE_START) / (FADE_END - FADE_START))
        : 1;

  // Running total ticks from 0 → TOTAL_END as each payment appears.
  const appeared = PAYMENTS.filter((p) => t >= p.appearAt);
  const lastAppear = appeared[appeared.length - 1]?.appearAt ?? 0;
  const nextIdx = appeared.length;
  const nextAppearAt = PAYMENTS[nextIdx]?.appearAt;
  let runningTotal = appeared.reduce((s, p) => s + p.amount, 0);
  if (nextAppearAt && t < nextAppearAt) {
    // Smoothly interpolate the total toward the next payment amount
    // so the ticker is buttery instead of jumping.
    const next = PAYMENTS[nextIdx];
    const progress = clamp((t - lastAppear) / (nextAppearAt - lastAppear));
    runningTotal += next.amount * easeOutCubic(progress);
  } else if (t >= FEED_DONE) {
    runningTotal = TOTAL_END;
  }

  const headlineOpacity =
    t < 0.8 ? clamp((t - 0.1) / 0.5) * cycleFade : cycleFade;
  const whileYouSleptOpacity = clamp((t - 4.8) / 0.8) * cycleFade;

  return (
    <div
      className="relative w-full max-w-3xl mx-auto"
      style={{ fontFamily: SANS_FAMILY }}
    >
      {/* Ambient purple glow behind the card — matches Scene 2's BGGlow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(91,0,255,0.28) 0%, transparent 60%), radial-gradient(ellipse at 75% 60%, rgba(124,58,255,0.22) 0%, transparent 60%)",
          filter: "blur(24px)",
          transform: "scale(1.15)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: "rgba(189,162,255,0.2)",
          background: "rgba(12,13,31,0.85)",
          boxShadow:
            "0 30px 80px rgba(91,0,255,0.22), 0 0 0 1px rgba(189,162,255,0.08) inset",
          backdropFilter: "blur(20px)",
          opacity: cycleFade,
          transition: reducedMotion ? "none" : undefined,
        }}
      >
        {/* Grid pattern */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(189,162,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(189,162,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 78%)",
          }}
        />

        {/* Content grid: feed on left, counter on right (stacked on small screens) */}
        <div className="relative grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* Payment feed */}
          <div
            className="md:col-span-3 border-b md:border-b-0 md:border-r"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <span
                style={{
                  fontFamily: MONO_FAMILY,
                  fontSize: 10,
                  letterSpacing: "0.25em",
                  color: "rgba(245,243,255,0.42)",
                  textTransform: "uppercase",
                }}
              >
                Live Payments · DoorStax
              </span>
              <span
                className="flex items-center gap-1.5"
                style={{
                  fontFamily: MONO_FAMILY,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "#4ADE80",
                  textTransform: "uppercase",
                }}
              >
                <span
                  className="relative inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#4ADE80",
                    boxShadow: "0 0 10px #4ADE80",
                    animation: reducedMotion
                      ? undefined
                      : "leadgen-pulse 1.4s ease-in-out infinite",
                  }}
                />
                Streaming
              </span>
            </div>

            <div className="relative px-3 py-3" style={{ minHeight: 260 }}>
              {PAYMENTS.map((p, i) => {
                const rowT = clamp((t - p.appearAt) / 0.55);
                if (rowT <= 0) return null;
                const e = easeOutCubic(rowT);

                // Newest row stays on top; older rows push down.
                const row = appeared.length - 1 - appeared.findIndex((a) => a.appearAt === p.appearAt);
                const isNewest = row === 0;

                return (
                  <div
                    key={i}
                    className="absolute left-3 right-3 flex items-center rounded-lg"
                    style={{
                      top: 12 + row * 42,
                      padding: "9px 12px",
                      background: isNewest
                        ? "rgba(124,58,255,0.12)"
                        : "transparent",
                      border: `1px solid ${
                        isNewest ? "rgba(189,162,255,0.2)" : "transparent"
                      }`,
                      opacity: e,
                      transform: `translateY(${(1 - e) * -18}px)`,
                      transition:
                        "top 400ms cubic-bezier(0.2,0.7,0.3,1), background 300ms, border-color 300ms",
                      fontFamily: SANS_FAMILY,
                    }}
                  >
                    <span
                      className="mr-3 inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: "#4ADE80",
                        boxShadow: isNewest ? "0 0 10px #4ADE80" : "none",
                      }}
                    />
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#F5F3FF",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="hidden sm:inline-block mr-3 text-right"
                      style={{
                        fontFamily: MONO_FAMILY,
                        fontSize: 10,
                        color: "rgba(245,243,255,0.42)",
                        width: 44,
                      }}
                    >
                      #{p.unit}
                    </span>
                    <span
                      className="mr-3 text-right"
                      style={{
                        fontFamily: MONO_FAMILY,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        color:
                          p.method === "CARD" ? "#BDA2FF" : "#4ADE80",
                        width: 32,
                      }}
                    >
                      {p.method}
                    </span>
                    <span
                      className="text-right tabular-nums"
                      style={{
                        fontFamily: MONO_FAMILY,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#F5F3FF",
                        minWidth: 68,
                      }}
                    >
                      ${p.amount.toLocaleString("en-US")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counter — big gradient number */}
          <div className="md:col-span-2 flex flex-col justify-center px-6 py-8 md:py-6 text-center md:text-left">
            <div
              style={{
                fontFamily: MONO_FAMILY,
                fontSize: 10,
                letterSpacing: "0.3em",
                color: "#BDA2FF",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Collected tonight
            </div>
            <div
              className="tabular-nums"
              style={{
                fontFamily: SANS_FAMILY,
                fontWeight: 300,
                fontSize: "clamp(40px, 8vw, 72px)",
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                background:
                  "linear-gradient(135deg, #BDA2FF 0%, #7C3AFF 55%, #5B00FF 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {formatCurrency(runningTotal)}
            </div>
            <div
              style={{
                fontFamily: SANS_FAMILY,
                fontSize: 14,
                fontWeight: 300,
                color: "rgba(245,243,255,0.58)",
                marginTop: 12,
                opacity: whileYouSleptOpacity,
                transition: reducedMotion ? "none" : undefined,
              }}
            >
              While you slept.
            </div>
          </div>
        </div>

        {/* Headline "Rent just hit." overlayed on first beat, fades with the scene. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-3 text-center"
          style={{
            fontFamily: MONO_FAMILY,
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "rgba(189,162,255,0.55)",
            textTransform: "uppercase",
            opacity: headlineOpacity,
          }}
        >
          3:17 AM · Tuesday
        </div>
      </div>

      <style>{`
        @keyframes leadgen-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
