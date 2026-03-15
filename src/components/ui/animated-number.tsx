"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatFn?: (n: number) => string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatFn,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState("0");
  const hasAnimated = useRef(false);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (hasAnimated.current) {
      // If already animated, just update directly
      setDisplay(
        formatFn
          ? formatFn(value)
          : value.toLocaleString("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
      );
      return;
    }

    hasAnimated.current = true;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = eased * value;

      setDisplay(
        formatFn
          ? formatFn(current)
          : current.toLocaleString("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
      );

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure final value is exact
        setDisplay(
          formatFn
            ? formatFn(value)
            : value.toLocaleString("en-US", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })
        );
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, decimals, formatFn]);

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
