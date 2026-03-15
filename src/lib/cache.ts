/**
 * Serverless-compatible caching using Upstash Redis.
 *
 * Gracefully degrades to a no-op (always cache miss) when Redis is unavailable.
 * Uses the same Redis instance as rate-limit.ts.
 */
import { getRedis } from "@/lib/rate-limit";

/**
 * Get a cached value by key.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) return null;
    return typeof raw === "string" ? JSON.parse(raw) : (raw as T);
  } catch (err) {
    console.error("[cache] Get error:", err);
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] Set error:", err);
  }
}

/**
 * Delete a cached value by key or prefix pattern.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // If key ends with *, scan and delete matching keys
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      // Use scan to find and delete matching keys
      const scanResult: [string, string[]] = await redis.scan(0, { match: `${prefix}*`, count: 100 });
      const keys = scanResult[1];
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const k of keys) {
          pipeline.del(k);
        }
        await pipeline.exec();
      }
    } else {
      await redis.del(key);
    }
  } catch (err) {
    console.error("[cache] Invalidate error:", err);
  }
}

/**
 * Cache-through helper: returns cached value or fetches and caches it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
