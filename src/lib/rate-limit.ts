/**
 * Serverless-compatible rate limiting using Upstash Redis.
 *
 * Gracefully degrades to a no-op when UPSTASH env vars are missing (local dev).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Redis singleton                                                    */
/* ------------------------------------------------------------------ */

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/** Expose the shared Redis instance for cache.ts and other modules. */
export { getRedis };

/* ------------------------------------------------------------------ */
/*  Limiter factory                                                    */
/* ------------------------------------------------------------------ */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
}

const NOOP_RESULT: RateLimitResult = {
  success: true,
  limit: 999,
  remaining: 999,
  reset: Date.now() + 60_000,
};

function createLimiter(
  prefix: string,
  maxRequests: number,
  windowSeconds: number
): { limit: (identifier: string) => Promise<RateLimitResult> } {
  const redis = getRedis();
  if (!redis) {
    // No-op limiter for local dev
    return { limit: async () => NOOP_RESULT };
  }

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `rl:${prefix}`,
    analytics: false,
  });

  return {
    limit: async (identifier: string) => {
      try {
        const res = await rl.limit(identifier);
        return {
          success: res.success,
          limit: res.limit,
          remaining: res.remaining,
          reset: res.reset,
        };
      } catch (err) {
        // Redis failure → allow the request (fail open)
        console.error("[rate-limit] Redis error, allowing request:", err);
        return NOOP_RESULT;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pre-configured limiters                                            */
/* ------------------------------------------------------------------ */

/** Auth endpoints: 10 req / 60s per IP */
export const authLimiter = createLimiter("auth", 10, 60);

/** Payment endpoints: 20 req / 60s per userId */
export const paymentLimiter = createLimiter("pay", 20, 60);

/** Webhook endpoints: 100 req / 60s per IP */
export const webhookLimiter = createLimiter("wh", 100, 60);

/** Public endpoints: 30 req / 60s per IP */
export const publicLimiter = createLimiter("pub", 30, 60);

/** Default authenticated endpoints: 60 req / 60s per userId */
export const defaultLimiter = createLimiter("def", 60, 60);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Extract client IP from a Request (handles proxies). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}

/** Return a 429 NextResponse with Retry-After header. */
export function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

/**
 * Create a per-API-key limiter with a custom rate.
 * Used when requests are authenticated via API key instead of session.
 */
export function createApiKeyLimiter(apiKeyId: string, maxPerMinute: number) {
  return createLimiter(`key:${apiKeyId}`, maxPerMinute, 60);
}
